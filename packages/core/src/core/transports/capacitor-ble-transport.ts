import EventEmitter from "eventemitter3";
import { IDeviceTransport, TransportEventMap, BluetoothLEScanFilter } from "./transport.interface";
import { BleClient, RequestBleDeviceOptions } from "@capacitor-community/bluetooth-le";

/**
 * CapacitorBleTransport utilizes the 'BleClient' wrapper from '@capacitor-community/bluetooth-le'.
 * Note: BleClient uses POSITIONAL arguments for most methods.
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

export class CapacitorBleTransport extends EventEmitter<TransportEventMap> implements IDeviceTransport {
    public readonly type = "Bluetooth-Capacitor";
    public readonly filterType = 'bluetooth-le' as const;
    private deviceId: string | null = null;
    private deviceName: string | undefined;
    private initialized = false;

    // Write queue to serialize GATT operations and prevent "operation already in progress" errors
    private writeQueue: QueuedWrite[] = [];
    private writeInProgress = false;

    // Cache the resolved write mode per characteristic UUID
    private writeModeCache: Map<string, WriteMode> = new Map();

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

    public async write(data: Uint8Array, characteristicsInfo: WriteCharacteristicsInfo): Promise<void> {
        if (!this.deviceId) throw new Error("Not connected");

        // Queue the write operation to serialize GATT operations
        return new Promise<void>((resolve, reject) => {
            const queuedWrite: QueuedWrite = { reject, run: async () => {
                try {
                    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

                    // Determine write mode: driver hint > cached mode > auto-detect
                    const cacheKey = `${characteristicsInfo.serviceUUID}|${characteristicsInfo.writeUUID}`.toLowerCase();
                    const cachedMode = this.writeModeCache.get(cacheKey);

                    const requestedMode = characteristicsInfo.writeMode;

                    let mode: WriteMode;
                    if (requestedMode) {
                        mode = requestedMode;
                    } else if (cachedMode) {
                        mode = cachedMode;
                    } else {
                        mode = 'auto';
                    }

                    let useWriteWithResponse: boolean;

                    if (mode === 'with-response') {
                        useWriteWithResponse = true;
                    } else if (mode === 'without-response') {
                        useWriteWithResponse = false;
                    } else {
                        // Auto: prefer without-response, fall back to with-response
                        useWriteWithResponse = await this.supportsWriteWithResponse(characteristicsInfo);
                    }

                    if (!useWriteWithResponse) {
                        try {
                            await BleClient.writeWithoutResponse(
                                this.deviceId!,
                                characteristicsInfo.serviceUUID,
                                characteristicsInfo.writeUUID,
                                view
                            );
                            // Cache successful without-response mode
                            this.writeModeCache.set(cacheKey, 'without-response');
                            resolve();
                            return;
                        } catch (e: any) {
                            // Fallback to write if writeWithoutResponse fails
                            console.warn("[CapacitorBle] writeWithoutResponse failed, trying write:", e.message);
                            useWriteWithResponse = true;
                        }
                    }

                    await BleClient.write(
                        this.deviceId!,
                        characteristicsInfo.serviceUUID,
                        characteristicsInfo.writeUUID,
                        view
                    );
                    // Cache successful with-response mode
                    this.writeModeCache.set(cacheKey, 'with-response');
                    resolve();
                } catch (error: any) {
                    console.error("[CapacitorBle] Write failed", error);
                    reject(error);
                } finally {
                    // A disconnect can clear this queue while the BLE call settles.
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

    private charPropsCache = new Map<string, { write: boolean; writeWithoutResponse: boolean }>();

    private async supportsWriteWithResponse(info: { serviceUUID: string; writeUUID: string }): Promise<boolean> {
        const key = `${info.serviceUUID}|${info.writeUUID}`.toLowerCase();
        const cached = this.charPropsCache.get(key);
        if (cached) return cached.write;

        let write = false;
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
            console.warn("[CapacitorBle] Could not read characteristic properties; assuming write-without-response", e);
        }
        return write;
    }

    public async startNotifications(characteristicsInfo: { serviceUUID: string; notifyUUID: string }): Promise<void> {
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
        const pendingWrites = this.writeQueue.splice(0);
        this.writeInProgress = false;
        for (const operation of pendingWrites) {
            operation.reject(new Error('Bluetooth disconnected. Reconnect the printer first.'));
        }
        this.writeModeCache.clear();
        this.emit("disconnected");
    }
}

/**
 * Every bundled driver contributes its own services through the scan filters.
 * Keeping a second handwritten list here made native discovery lag behind the
 * web build \u2014 notably, the Tiny family's AE30 service was missing entirely.
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
