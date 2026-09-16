import EventEmitter from "eventemitter3";
import { IDeviceTransport, TransportEventMap, BluetoothLEScanFilter } from "./transport.interface";
import { BleClient, RequestBleDeviceOptions } from "@capacitor-community/bluetooth-le";

/**
 * CapacitorBleTransport utilizes the 'BleClient' wrapper from '@capacitor-community/bluetooth-le'.
 * Note: BleClient uses POSITIONAL arguments for most methods.
 */
export class CapacitorBleTransport extends EventEmitter<TransportEventMap> implements IDeviceTransport {
    public readonly type = "Bluetooth-Capacitor";
    public readonly filterType = 'bluetooth-le' as const;
    private deviceId: string | null = null;
    private deviceName: string | undefined;
    private initialized = false;

    private async ensureInitialized() {
        if (!this.initialized) {
            await BleClient.initialize();
            this.initialized = true;
        }
    }

    public async connect(filters: BluetoothLEScanFilter[] = []): Promise<void> {
        await this.ensureInitialized();

        const requestOptions: RequestBleDeviceOptions = {
            optionalServices: collectOptionalServices(filters, [
                '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
                '0000180a-0000-1000-8000-00805f9b34fb'  // Device Information
            ])
        } as any;

        // Use any cast because acceptAllDevices is supported by Web Bluetooth 
        // behind the scenes in Capacitor but might be missing in some TS definitions.
        (requestOptions as any).acceptAllDevices = true;

        try {
            const device = await BleClient.requestDevice(requestOptions);
            this.deviceId = device.deviceId;
            this.deviceName = device.name;
            localStorage.setItem('bleDeviceId', this.deviceId);
            if (this.deviceName) localStorage.setItem('bleDeviceName', this.deviceName);

            // BleClient.connect(deviceId, onDisconnect)
            await BleClient.connect(this.deviceId, (id) => {
                console.log(`[CapacitorBle] Disconnected from ${id}`);
                this.handleDisconnect();
            });

            // Handle generic names
            const nameLower = (this.deviceName || "").toLowerCase();
            const isGenericName = !this.deviceName ||
                nameLower.includes("unknown") ||
                nameLower.includes("unbekannt") ||
                nameLower.includes("n/a");

            if (isGenericName && this.deviceId) {
                try {
                    console.log("[CapacitorBle] Name is generic. Attempting GATT Name Read (1800/2A00)...");
                    const nameResult = await BleClient.read(
                        this.deviceId,
                        '00001800-0000-1000-8000-00805f9b34fb',
                        '00002a00-0000-1000-8000-00805f9b34fb'
                    );

                    if (nameResult && nameResult.byteLength > 0) {
                        const decoder = new TextDecoder("utf-8");
                        const name = decoder.decode(nameResult);
                        if (name && name.trim()) {
                            console.log(`[CapacitorBle] Resolved real name via GATT: ${name}`);
                            this.deviceName = name.trim();
                        }
                    }
                } catch (e) {
                    console.warn("[CapacitorBle] GATT name read failed", e);
                }
            }

            if (!this.deviceName) {
                console.warn("[CapacitorBle] Connected but name is still unknown.");
            } else {
                console.log(`[CapacitorBle] Connected to: ${this.deviceName}`);
            }

            this.emit("connected");
        } catch (error: any) {
            console.error("[CapacitorBle] Connection failed", error);
            this.emit("error", error);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        if (this.deviceId) {
            await BleClient.disconnect(this.deviceId);
            this.handleDisconnect();
        }
    }

    public async write(data: Uint8Array, characteristicsInfo: { serviceUUID: string, writeUUID: string }): Promise<void> {
        if (!this.deviceId) throw new Error("Not connected");

        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        try {
            // The transport owns the write mode and picks it from the
            // characteristic's own GATT properties, mirroring the web transport.
            // Prefer write-with-response for command/query characteristics: the
            // Marklife INFO service only answers queries written with response,
            // and a write-without-response is silently dropped there. Fall back
            // to write-without-response for characteristics that only advertise
            // it. This matches what the original BleWebler did with `writeValue`.
            if (await this.supportsWriteWithResponse(characteristicsInfo)) {
                await BleClient.write(
                    this.deviceId,
                    characteristicsInfo.serviceUUID,
                    characteristicsInfo.writeUUID,
                    view
                );
            } else {
                await BleClient.writeWithoutResponse(
                    this.deviceId,
                    characteristicsInfo.serviceUUID,
                    characteristicsInfo.writeUUID,
                    view
                );
            }
        } catch (error: any) {
            console.error("[CapacitorBle] Write failed", error);
            throw error;
        }
    }

    private charPropsCache = new Map<string, { write: boolean; writeWithoutResponse: boolean }>();

    private async supportsWriteWithResponse(info: { serviceUUID: string, writeUUID: string }): Promise<boolean> {
        const key = `${info.serviceUUID}|${info.writeUUID}`.toLowerCase();
        const cached = this.charPropsCache.get(key);
        if (cached) return cached.write;

        let write = true;
        try {
            const services = await BleClient.getServices(this.deviceId!);
            const service = services.find(s => s.uuid.toLowerCase() === info.serviceUUID.toLowerCase());
            const char = service?.characteristics?.find(c => c.uuid.toLowerCase() === info.writeUUID.toLowerCase());
            const props = char?.properties;
            if (props) {
                write = Boolean(props.write);
                this.charPropsCache.set(key, { write, writeWithoutResponse: Boolean(props.writeWithoutResponse) });
            }
        } catch (e) {
            console.warn("[CapacitorBle] Could not read characteristic properties; assuming write-with-response", e);
        }
        return write;
    }

    public async startNotifications(characteristicsInfo: { serviceUUID: string, notifyUUID: string }): Promise<void> {
        if (!this.deviceId) throw new Error("Not connected");

        await BleClient.startNotifications(
            this.deviceId,
            characteristicsInfo.serviceUUID,
            characteristicsInfo.notifyUUID,
            (value: DataView) => {
                const array = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
                this.emit("data", array, characteristicsInfo.notifyUUID);
            }
        );
    }

    public isConnected(): boolean {
        return !!this.deviceId;
    }

    public getDeviceName(): string | undefined {
        return this.deviceName;
    }

    public async getPrimaryServices(): Promise<string[]> {
        if (!this.deviceId) return [];
        try {
            const services = await BleClient.getServices(this.deviceId);
            return services.map(s => s.uuid.toLowerCase());
        } catch (e) {
            console.error("[CapacitorBle] Failed to get services", e);
            return [];
        }
    }

    private handleDisconnect() {
        this.deviceId = null;
        this.deviceName = undefined;
        this.charPropsCache.clear();
        this.emit("disconnected");
    }
}

/**
 * Every bundled driver contributes its own services through the scan filters.
 * Keeping a second handwritten list here made native discovery lag behind the
 * web build — notably, the Tiny family's AE30 service was missing entirely.
 */
export function collectOptionalServices(
    filters: BluetoothLEScanFilter[],
    baseline: string[] = []
): string[] {
    const services = new Map<string, string>();
    for (const service of [...baseline, ...filters.flatMap(filter => filter.services ?? [])]) {
        const clean = service.toLowerCase().replace(/-/g, '');
        const key = clean.length === 4
            ? `0000${clean}00001000800000805f9b34fb`
            : clean.length === 8
                ? `${clean}00001000800000805f9b34fb`
                : clean;
        if (!services.has(key)) services.set(key, service.toLowerCase());
    }
    return [...services.values()];
}
