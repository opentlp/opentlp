import type { IDeviceTransport } from '../../core/transports/transport.interface';
import type { IPrinterDriver, PrinterCapabilities, PrinterModelProfile, UniversalPrintOptions } from '../driver.interface';
import { singlePlane, type UniversalPage } from '../../types/ink';
import { rotateToPrintRows } from './raster';
import * as Protocol from './mxw01-protocol';

const SERVICE = '0000ae30-0000-1000-8000-00805f9b34fb';
const SERVICE_ALT = '0000af30-0000-1000-8000-00805f9b34fb';
const SERVICE_FFA0 = '0000ffa0-0000-1000-8000-00805f9b34fb';
const WRITE_FFA1 = '0000ffa1-0000-1000-8000-00805f9b34fb';
const NOTIFY_FFA2 = '0000ffa2-0000-1000-8000-00805f9b34fb';

const MODELS = [
    'MXW01', 'MXW01-1', 'V5X', 'X1', 'X2', 'C17', 'MXW-W5', 'AC695X_PRINT',
    'JK01', 'PORTABLEPRINTER', 'INSTANTPRINTPLUS', 'REKA', 'HDMDT-00', 'KERUI', 'BH03',
    'M8HZ', 'HZ-M8', 'Q15', 'M13', 'Q15A', 'Q15B', 'Q15C', 'Q15D', 'Q15E',
    'STICKERMATE', 'Q17', 'MXW13', 'MXW18', 'ADQ19', 'QD01', 'JME13', 'JME15',
    'LP28AI', 'BQTLY', 'STERENIA-PRINT', 'LEAPOM', 'IHEARTYARD', 'ELECOUTEK',
    'Q25SZY', 'TCM747736', 'Q5', 'Q6', 'JME05', 'Q10', 'BHSZY', 'PD03', 'FLYINGTIGER097', 'LP215',
    'AI01', 'JK02', 'JP01', 'YY01', 'JK03', 'KERE03', 'YMX08', 'YMX10', 'CY08',
    'KS03', 'HS03', 'JPH03', 'DY03', 'EY03', 'SY03', 'JY03', 'HDS03', 'GM01',
    'V8', 'V9', 'PRINTER_Q8', 'DY05', 'F8', 'D20', 'GD82', 'BW6', 'A12', 'JRP01',
    'ZWY03', 'ZWY05', 'YT_PRINT', 'AI88', 'AI-82', 'GH03', '58T3', 'K33',
    'MYFIRSTINSTAMAGIBOX', 'LH01', 'WUFK-PRT', 'MD-AICP20', 'M0XIPRINTER',
    'K330', 'LH03', 'MAI10', 'V7', 'MOXIPRINTER', 'V5-SE', 'V5-SE-SM', 'YMXD2',
    'YMXD3', 'WKN01', 'M9AI', 'YMXIN01', 'ZWY08', 'KS08', 'JK08', 'LFC', 'ARNSSIEN',
    'YMX-M8AI', 'SL02', 'WZK-X11', 'YP09', 'TT-TPRINT', 'INSTAPRINT'
] as const;

function capabilities(): PrinterCapabilities {
    return {
        canvasHeightPx: Protocol.PRINTHEAD_DOTS,
        dpmm: 8,
        maxDensity: 8,
        supportsSpeedMode: false,
        colorSupport: { type: 'monochrome' },
        physical: { supportedMediaWidthsMm: 58 }
    };
}

export const CATPRINTER_MXW01_MODELS: PrinterModelProfile[] = MODELS.map(model => ({
    id: `catprinter_v5x_${model.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    brand: 'Generic Cat Printer',
    model,
    family: 'V5X/MXW01 bulk raster',
    supportLevel: 'Untested',
    capabilities: capabilities(),
    notes: 'Experimental community support for the 22 21 control and AE03 bulk-raster protocol.'
}));

export class CatPrinterMxw01Driver implements IPrinterDriver {
    readonly name = 'Catprinter (V5X/MXW01 bulk raster)';
    readonly driverType = 'hardware' as const;
    readonly app = 'WalkPrint';
    readonly replacesApps = ['WalkPrint'] as const;
    readonly defaultKind = 'pocket' as const;
    readonly supportedKinds = ['pocket'] as const;
    readonly supportedTransports = ['bluetooth-le'] as const;
    readonly connectionRequirements = { services: [SERVICE, SERVICE_ALT, SERVICE_FFA0], namePrefixes: [...MODELS] };
    readonly supportedModels = CATPRINTER_MXW01_MODELS;

    private transport?: IDeviceTransport;
    private serviceUUID = SERVICE;
    private controlWriteUUID = Protocol.CONTROL_WRITE;
    private dataWriteUUID = Protocol.DATA_WRITE;
    private notificationsReady = false;
    private responses = new Map<number, Uint8Array[]>();
    private waiters = new Map<number, Array<(payload: Uint8Array) => void>>();

    isCompatible(deviceName: string): boolean {
        const upper = deviceName.trim().toUpperCase();
        return MODELS.some(model => upper === model
            || upper.startsWith(`${model}-`)
            || upper.startsWith(`${model}_`));
    }

    async bindTransport(transport: IDeviceTransport): Promise<void> {
        this.transport = transport;
        transport.on('data', this.handleData);
        if (transport.startNotifications) {
            for (const serviceUUID of [SERVICE, SERVICE_ALT, SERVICE_FFA0]) {
                const notifyUUID = serviceUUID === SERVICE_FFA0 ? NOTIFY_FFA2 : Protocol.NOTIFY;
                try {
                    await transport.startNotifications({ serviceUUID, notifyUUID });
                    this.serviceUUID = serviceUUID;
                    if (serviceUUID === SERVICE_FFA0) {
                        this.controlWriteUUID = WRITE_FFA1;
                        this.dataWriteUUID = WRITE_FFA1;
                    } else {
                        this.controlWriteUUID = Protocol.CONTROL_WRITE;
                        this.dataWriteUUID = Protocol.DATA_WRITE;
                    }
                    this.notificationsReady = true;
                    break;
                } catch {
                    // Some Apple stacks expose AF30 for the otherwise identical service.
                }
            }
        }
    }

    async unbindTransport(): Promise<void> {
        this.transport?.off('data', this.handleData);
        this.transport = undefined;
        this.serviceUUID = SERVICE;
        this.controlWriteUUID = Protocol.CONTROL_WRITE;
        this.dataWriteUUID = Protocol.DATA_WRITE;
        this.notificationsReady = false;
        this.responses.clear();
        this.waiters.clear();
    }

    getCapabilities(): PrinterCapabilities {
        return { ...capabilities(), driverName: this.name };
    }

    async printInit(options: UniversalPrintOptions): Promise<void> {
        const density = Math.max(1, Math.min(8, Math.round(options.density || 4)));
        const intensity = Math.round(40 + ((density - 1) / 7) * 120);
        await this.writeControl(Protocol.setIntensity(intensity));
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    async printPage(page: UniversalPage): Promise<void> {
        const data = Protocol.prepareRaster(rotateToPrintRows(singlePlane(page), Protocol.PRINTHEAD_DOTS));
        const rowCount = data.length / Protocol.ROW_BYTES;

        this.responses.delete(0xa9);
        await this.writeControl(Protocol.printRequest(rowCount));
        if (this.notificationsReady) {
            const acknowledgement = await this.waitForResponse(0xa9, 3000);
            if (acknowledgement[0] !== 0) throw new Error('MXW01 rejected the print request.');
        } else {
            // A small number of transports cannot expose notifications; retain a best-effort path.
            await new Promise(resolve => setTimeout(resolve, 150));
        }

        for (let offset = 0; offset < data.length; offset += Protocol.ROW_BYTES) {
            await this.writeData(data.slice(offset, offset + Protocol.ROW_BYTES));
            if (offset + Protocol.ROW_BYTES < data.length) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    }

    async printEnd(): Promise<void> {
        await this.writeControl(Protocol.flush);
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    private requireTransport(): IDeviceTransport {
        if (!this.transport) throw new Error('Catprinter MXW01 transport is not bound.');
        return this.transport;
    }

    private writeControl(data: Uint8Array): Promise<void> {
        return this.requireTransport().write(data, {
            serviceUUID: this.serviceUUID,
            writeUUID: this.controlWriteUUID
        });
    }

    private writeData(data: Uint8Array): Promise<void> {
        return this.requireTransport().write(data, {
            serviceUUID: this.serviceUUID,
            writeUUID: this.dataWriteUUID
        });
    }

    private handleData = (data: Uint8Array): void => {
        const response = Protocol.parseNotification(data);
        if (!response) return;
        const waiter = this.waiters.get(response.opcode)?.shift();
        if (waiter) {
            waiter(response.payload);
            return;
        }
        const queued = this.responses.get(response.opcode) ?? [];
        queued.push(response.payload);
        this.responses.set(response.opcode, queued);
    };

    private waitForResponse(opcode: number, timeoutMs: number): Promise<Uint8Array> {
        const queued = this.responses.get(opcode)?.shift();
        if (queued) return Promise.resolve(queued);

        return new Promise((resolve, reject) => {
            const done = (payload: Uint8Array) => {
                clearTimeout(timeout);
                resolve(payload);
            };
            const timeout = setTimeout(() => {
                const waiters = this.waiters.get(opcode);
                const index = waiters?.indexOf(done) ?? -1;
                if (index >= 0) waiters?.splice(index, 1);
                reject(new Error(`Timed out waiting for MXW01 response 0x${opcode.toString(16)}.`));
            }, timeoutMs);
            const waiters = this.waiters.get(opcode) ?? [];
            waiters.push(done);
            this.waiters.set(opcode, waiters);
        });
    }
}

