import { IDeviceTransport } from "../../core/transports/transport.interface";

export class MarklifeFlowControl {
    private credits: number = 0;
    private resolveCredits: (() => void) | null = null;
    private aborted: boolean = false;
    private readonly chunkSize = 90;

    constructor() { }

    /**
     * Handles incoming flow control notifications (0xFF03)
     */
    public handleNotification(data: Uint8Array) {
        if (data.length >= 2 && data[0] === 0x01) {
            if (data[1] === 0x04) {
                this.credits = 4;
            } else {
                this.credits += data[1];
            }

            if (this.resolveCredits && this.credits > 0) {
                this.resolveCredits();
                this.resolveCredits = null;
            }
        }
    }

    /**
     * Set initial fallback credits if flow control is not available
     */
    public setFallbackCredits(credits: number) {
        this.credits = credits;
    }

    /**
     * Sends a large buffer in chunks, obeying credit limits.
     */
    public async sendData(
        data: Uint8Array,
        transport: IDeviceTransport,
        serviceUUID: string,
        writeCharacteristicId: string,
        useFlowControl: boolean,
        /** Pause between chunks in ms; defaults to 5 with credits, 30 without. */
        interChunkDelayMs?: number
    ): Promise<void> {
        this.aborted = false;

        // If it's a USB transport, rely on the native hardware flow control of USB Bulk Endpoints
        // and bypass our artificial chunking entirely for maximum print speed.
        if (transport.type && transport.type.toLowerCase().includes('usb')) {
            await transport.write(data, { 
                serviceUUID, 
                writeUUID: writeCharacteristicId 
            });
            return;
        }

        // Serial connections (Bluetooth RFCOMM or USB-Serial) rely on OS-level buffers and
        // do not use BLE GATT 0xFF03 credit notifications.
        const isSerial = transport.type && transport.type.toLowerCase().includes('serial');
        if (isSerial || transport.filterType === 'none') {
            useFlowControl = false;
        }

        let offset = 0;

        while (offset < data.length) {
            if (this.aborted) {
                throw new Error("Print job aborted");
            }

            if (useFlowControl) {
                if (this.credits <= 0) {
                    await new Promise<void>(resolve => {
                        const timer = setTimeout(() => {
                            this.resolveCredits = null;
                            resolve();
                        }, 1000);
                        this.resolveCredits = () => {
                            clearTimeout(timer);
                            resolve();
                        };
                    });
                }
                if (this.aborted) {
                    throw new Error("Print job aborted");
                }
                this.credits--;
            }

            const end = Math.min(offset + this.chunkSize, data.length);
            const chunk = data.slice(offset, end);

            await transport.write(chunk, { 
                serviceUUID, 
                writeUUID: writeCharacteristicId 
            });

            offset += this.chunkSize;

            const delay = interChunkDelayMs ?? (useFlowControl ? 5 : 30);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    public reset() {
        this.aborted = true;
        this.credits = 0;
        if (this.resolveCredits) {
            this.resolveCredits();
            this.resolveCredits = null;
        }
    }
}
