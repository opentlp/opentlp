import EventEmitter from "eventemitter3";
import { IDeviceTransport, BluetoothLEScanFilter, TransportEventMap } from "./transport.interface";

/**
 * UniversalBluetoothTransport relies on the standard Web Bluetooth API `navigator.bluetooth`.
 */
export type WriteMode = 'with-response' | 'without-response' | 'auto';

export interface WriteCharacteristicsInfo {
    serviceUUID: string;
    writeUUID: string;
    writeMode?: WriteMode;
}

interface QueuedWrite {
    run: () => Promise<void>;
    reject: (reason: unknown) => void;
}

export class UniversalBluetoothTransport extends EventEmitter<TransportEventMap> implements IDeviceTransport {
    public readonly type = "Bluetooth";
    public readonly filterType = 'bluetooth-le' as const;

    private device?: BluetoothDevice;
    private server?: BluetoothRemoteGATTServer;
    private primaryServiceUUIDs?: string[];

    // Track the connected characteristics per service required by drivers
    private notifyCharacteristics: Map<string, BluetoothRemoteGATTCharacteristic> = new Map();
    private writeCharacteristics: Map<string, BluetoothRemoteGATTCharacteristic> = new Map();

    // Write queue to serialize GATT operations and prevent "operation already in progress" errors
    private writeQueue: QueuedWrite[] = [];
    private writeInProgress = false;

    // Cache the resolved write mode per characteristic UUID
    private writeModeCache: Map<string, WriteMode> = new Map();

    async connect(filters: BluetoothLEScanFilter[] = []): Promise<void> {
        if (!navigator.bluetooth) {
            throw new Error("Web Bluetooth API is not available in your environment.");
        }

        let options: RequestDeviceOptions;
        const optionalServices = filters.reduce<BluetoothServiceUUID[]>((acc, f) => acc.concat((f.services as BluetoothServiceUUID[]) || []), []);

        // To maximize compatibility across OS (specifically Windows/Android differences in broadcasting),
        // we use acceptAllDevices and pass the required driver services as optionalServices 
        // so we can still communicate with them once connected.
        options = { acceptAllDevices: true, optionalServices };

        try {
            this.device = await navigator.bluetooth.requestDevice(options);
            this.device.addEventListener("gattserverdisconnected", this.onDisconnected);

            if (!this.device.gatt) {
                throw new Error("Device does not support GATT.");
            }

            // Chromium may resolve gatt.connect() and then immediately lose the
            // link while it performs the first service discovery. Complete that
            // discovery here, before advertising a usable transport, and retry
            // the short-lived initial drop once.
            await this.connectAndDiscover(this.device.gatt);
            this.emit("connected");
        } catch (error: any) {
            if (this.device?.gatt?.connected) this.device.gatt.disconnect();
            this.clearConnectionCache();
            this.emit("error", error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (this.device && this.device.gatt?.connected) {
            this.device.gatt.disconnect();
        }
        this.clearConnectionCache();
    }

    async write(data: Uint8Array, characteristicsInfo?: WriteCharacteristicsInfo): Promise<void> {
        if (!characteristicsInfo) {
            throw new Error("Transport is not fully connected or characteristicsInfo is missing.");
        }
        // Queue the write operation to serialize GATT operations
        return new Promise<void>((resolve, reject) => {
            const queuedWrite: QueuedWrite = { reject, run: async () => {
                try {
                    const server = this.requireConnectedServer();

                    // A caching mechanism to retain characteristics could go here
                    let writeChar = this.writeCharacteristics.get(characteristicsInfo!.writeUUID);

                    if (!writeChar) {
                        const service = await server.getPrimaryService(characteristicsInfo!.serviceUUID);
                        writeChar = await service.getCharacteristic(characteristicsInfo!.writeUUID);
                        this.writeCharacteristics.set(characteristicsInfo!.writeUUID, writeChar);
                    }

                    // `data` may be a subarray view whose `.buffer` is larger than the
                    // payload (offset/length), so copy it into a tight buffer first;
                    // passing the underlying ArrayBuffer would transmit trailing garbage.
                    const payload: Uint8Array = (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength)
                        ? data
                        : data.slice();

                    const targetChar = writeChar as any;
                    
                    // Determine write mode: driver hint > cache > auto-detect
                    const requestedMode = characteristicsInfo!.writeMode;
                    const cachedMode = this.writeModeCache.get(characteristicsInfo!.writeUUID);
                    const mode = requestedMode ?? cachedMode ?? 'auto';
                    
                    let actualMode: WriteMode;
                    
                    if (mode === 'with-response') {
                        actualMode = 'with-response';
                    } else if (mode === 'without-response') {
                        actualMode = 'without-response';
                    } else {
                        // Auto-detect: check characteristic properties
                        const props = writeChar.properties;
                        const supportsWithoutResponse = props ? Boolean(props.writeWithoutResponse) : false;
                        const supportsWithResponse = props ? Boolean(props.write) : true;
                        
                        if (supportsWithoutResponse && !supportsWithResponse) {
                            actualMode = 'without-response';
                        } else if (!supportsWithoutResponse && supportsWithResponse) {
                            actualMode = 'with-response';
                        } else {
                            // Both supported: prefer without-response for performance
                            actualMode = 'without-response';
                        }
                    }
                    
                    // Cache the resolved mode for this characteristic
                    if (requestedMode) {
                        this.writeModeCache.set(characteristicsInfo!.writeUUID, requestedMode);
                    } else if (!cachedMode) {
                        this.writeModeCache.set(characteristicsInfo!.writeUUID, actualMode);
                    }
                    
                    // Execute the write with the determined mode
                    if (actualMode === 'with-response') {
                        if (typeof targetChar.writeValueWithResponse === 'function') {
                            await targetChar.writeValueWithResponse(payload);
                        } else if (typeof targetChar.writeValue === 'function') {
                            await targetChar.writeValue(payload);
                        } else {
                            throw new Error('No write method available for write-with-response');
                        }
                    } else {
                        // without-response
                        try {
                            if (typeof targetChar.writeValueWithoutResponse === 'function') {
                                await targetChar.writeValueWithoutResponse(payload);
                            } else if (typeof targetChar.writeValue === 'function') {
                                await targetChar.writeValue(payload);
                            } else {
                                throw new Error('No write method available');
                            }
                        } catch (e: any) {
                            // Fallback to with-response if without-response fails
                            if (typeof targetChar.writeValueWithResponse === 'function') {
                                await targetChar.writeValueWithResponse(payload);
                                this.writeModeCache.set(characteristicsInfo!.writeUUID, 'with-response');
                            } else if (typeof targetChar.writeValue === 'function') {
                                await targetChar.writeValue(payload);
                                this.writeModeCache.set(characteristicsInfo!.writeUUID, 'with-response');
                            } else {
                                throw e;
                            }
                        }
                    }
                    resolve();
                } catch (error) {
                    reject(error);
                } finally {
                    // A disconnect can clear this queue while the GATT call settles.
                    // Do not let that old call remove work from a new connection.
                    if (this.writeQueue[0] === queuedWrite) {
                        this.writeQueue.shift();
                        this.writeInProgress = false;
                        this.processWriteQueue();
                    }
                }
            } };
            this.writeQueue.push(queuedWrite);
            this.processWriteQueue();
        });
    }

    private processWriteQueue(): void {
        if (this.writeInProgress || this.writeQueue.length === 0) return;
        this.writeInProgress = true;
        const operation = this.writeQueue[0];
        void operation.run().catch(() => {
            // Errors are already handled in the operation itself
        });
    }

    /**
     * Instructs the transport to begin emitting 'data' events for a specific channel/characteristic.
     */
    async startNotifications(characteristicsInfo: { serviceUUID: string, notifyUUID: string }): Promise<void> {
        const server = this.requireConnectedServer();

        let notifyChar = this.notifyCharacteristics.get(characteristicsInfo.notifyUUID);

        if (!notifyChar) {
            const service = await server.getPrimaryService(characteristicsInfo.serviceUUID);
            notifyChar = await service.getCharacteristic(characteristicsInfo.notifyUUID);
            this.notifyCharacteristics.set(characteristicsInfo.notifyUUID, notifyChar);
        }

        notifyChar.addEventListener("characteristicvaluechanged", (event: any) => {
            const value = event.target.value as DataView;
            const array = new Uint8Array(value.buffer as ArrayBuffer);
            // Emitting the UUID back so drivers know the source of the packet
            this.emit("data", array, characteristicsInfo.notifyUUID);
        });
        await notifyChar.startNotifications();
    }

    private onDisconnected = () => {
        this.clearConnectionCache();
        this.emit("disconnected");
    };

    isConnected(): boolean {
        return this.device?.gatt?.connected ?? false;
    }

    getDeviceName(): string | undefined {
        return this.device?.name;
    }

    /**
     * Retrieves all discovered primary GATT services for the connected device.
     */
    async getPrimaryServices(): Promise<string[]> {
        this.requireConnectedServer();
        if (this.primaryServiceUUIDs) return [...this.primaryServiceUUIDs];
        const services = await this.server!.getPrimaryServices();
        this.primaryServiceUUIDs = services.map(s => s.uuid);
        return [...this.primaryServiceUUIDs];
    }

    /**
     * Retrieves all characteristics for a given service.
     */
    async getCharacteristics(serviceUUID: string): Promise<{ uuid: string, properties: any }[]> {
        const service = await this.requireConnectedServer().getPrimaryService(serviceUUID);
        const characteristics = await service.getCharacteristics();
        return characteristics.map(c => ({
            uuid: c.uuid,
            properties: {
                broadcast: c.properties.broadcast,
                read: c.properties.read,
                writeWithoutResponse: c.properties.writeWithoutResponse,
                write: c.properties.write,
                notify: c.properties.notify,
                indicate: c.properties.indicate,
                authenticatedSignedWrites: c.properties.authenticatedSignedWrites,
                reliableWrite: c.properties.reliableWrite,
                writableAuxiliaries: c.properties.writableAuxiliaries
            }
        }));
    }

    private async connectAndDiscover(gatt: BluetoothRemoteGATTServer): Promise<void> {
        let lastError: unknown;
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                this.server = await gatt.connect();
                const services = await this.server.getPrimaryServices();
                if (!gatt.connected) throw new DOMException('GATT Server disconnected during service discovery.', 'NetworkError');
                this.primaryServiceUUIDs = services.map(service => service.uuid);
                return;
            } catch (error) {
                lastError = error;
                this.clearConnectionCache();
                if (attempt > 0 || !this.isTransientGattError(error)) throw error;
                if (gatt.connected) gatt.disconnect();
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        throw lastError;
    }

    private requireConnectedServer(): BluetoothRemoteGATTServer {
        if (!this.server?.connected || !this.device?.gatt?.connected) {
            throw new DOMException('GATT Server is disconnected. Reconnect the printer first.', 'NetworkError');
        }
        return this.server;
    }

    private isTransientGattError(error: unknown): boolean {
        return error instanceof DOMException
            ? error.name === 'NetworkError'
            : error instanceof Error && /gatt|disconnect|network/i.test(error.message);
    }

    private clearConnectionCache(): void {
        this.server = undefined;
        this.primaryServiceUUIDs = undefined;
        this.writeCharacteristics.clear();
        this.notifyCharacteristics.clear();
        const pendingWrites = this.writeQueue.splice(0);
        this.writeInProgress = false;
        for (const operation of pendingWrites) {
            operation.reject(new DOMException('GATT Server disconnected. Reconnect the printer first.', 'NetworkError'));
        }
        this.writeModeCache.clear();
    }
}
