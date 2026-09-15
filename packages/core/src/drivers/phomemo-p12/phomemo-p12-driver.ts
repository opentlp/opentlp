import type { IDeviceTransport } from '../../core/transports/transport.interface';
import type { IPrinterDriver, PrinterCapabilities, PrinterModelProfile, UniversalPrintOptions, ConnectionHints } from '../driver.interface';
import { singlePlane, type UniversalPage } from '../../types/ink';
import * as Protocol from './p12-protocol';
import { encodeRotatedRaster } from './raster';

const SERVICE = '0000ff00-0000-1000-8000-00805f9b34fb';
const WRITE = '0000ff02-0000-1000-8000-00805f9b34fb';
const NOTIFY = '0000ff03-0000-1000-8000-00805f9b34fb';

interface P12Model { model: string; headDots: number; media: number | { min: number; max: number }; }
const MODELS: readonly P12Model[] = [
    { model: 'P12', headDots: 96, media: 12 },
    { model: 'P12 Pro', headDots: 96, media: 12 },
    { model: 'A30', headDots: 120, media: { min: 12, max: 15 } }
];

const P12_BROADCAST_PREFIXES = ['Q037', 'Q090', 'Q091', 'Q094', 'Q112', 'Q129', 'Q245'];
const P12_PRO_BROADCAST_PREFIXES = ['Q113', 'Q534'];
const A30_BROADCAST_PREFIXES = ['Q294', 'Q295', 'Q574', 'Q695', 'Q732', 'Q772', 'Q846'];
const NAMED_PREFIXES = ['P12 PRO', 'P12PRO', 'P12', 'A30'];

function capabilities(model: P12Model): PrinterCapabilities {
    return {
        canvasHeightPx: model.headDots,
        dpmm: 8,
        maxDensity: 1,
        supportsSpeedMode: false,
        colorSupport: { type: 'monochrome' },
        physical: { supportedMediaWidthsMm: model.media }
    };
}

export const PHOMEMO_P12_MODELS: PrinterModelProfile[] = MODELS.map(model => ({
    id: `phomemo_${model.model.toLowerCase().replace(/\s+/g, '_')}`,
    brand: 'Phomemo',
    model: model.model,
    family: 'P12/A30 tape protocol',
    supportLevel: 'Untested',
    capabilities: capabilities(model),
    notes: 'Experimental support. Select this family manually when a P12 name is ambiguous with Marklife hardware.'
}));

export class PhomemoP12Driver implements IPrinterDriver {
    readonly id = 'phomemo-p12';
    readonly name = 'Phomemo P12/A30';
    readonly driverType = 'hardware' as const;
    readonly app = 'Phomemo';
    readonly replacesApps = ['Phomemo', 'Print Master'] as const;
    readonly defaultKind = 'label' as const;
    readonly supportedKinds = ['label'] as const;
    readonly supportedTransports = ['bluetooth-le', 'bluetooth-classic', 'usb-serial'] as const;
    readonly connectionRequirements = {
        services: [SERVICE],
        namePrefixes: [
            ...NAMED_PREFIXES,
            ...P12_BROADCAST_PREFIXES,
            ...P12_PRO_BROADCAST_PREFIXES,
            ...A30_BROADCAST_PREFIXES
        ]
    };
    readonly supportedModels = PHOMEMO_P12_MODELS;
    readonly connectionHints: ConnectionHints = {
        bleHint: 'Turn on your printer, click Connect, and select your device in the popup list.',
        bluetoothClassicHint: 'Select your Phomemo printer in the list.'
    };

    private transport?: IDeviceTransport;
    private deviceName = '';
    private notificationsAvailable = false;

    isCompatible(deviceName: string): boolean {
        const upper = deviceName.trim().toUpperCase();
        if (NAMED_PREFIXES.some(name => upper === name || upper.startsWith(`${name}-`) || upper.startsWith(`${name}_`))) {
            return true;
        }
        return [...P12_BROADCAST_PREFIXES, ...P12_PRO_BROADCAST_PREFIXES, ...A30_BROADCAST_PREFIXES]
            .some(p => upper.startsWith(p));
    }

    async bindTransport(transport: IDeviceTransport): Promise<void> {
        this.transport = transport;
        this.deviceName = transport.getDeviceName()?.toUpperCase() ?? '';
        this.notificationsAvailable = false;
        if (transport.startNotifications) {
            try {
                await transport.startNotifications({ serviceUUID: SERVICE, notifyUUID: NOTIFY });
                this.notificationsAvailable = true;
            } catch {
                // Fixed pacing below is the fallback for devices without notify.
            }
        }
    }

    async unbindTransport(): Promise<void> {
        this.transport = undefined;
        this.deviceName = '';
        this.notificationsAvailable = false;
    }

    getCapabilities(): PrinterCapabilities {
        return { ...capabilities(this.matchModel()), driverId: this.id, driverName: this.name };
    }

    async printInit(_options: UniversalPrintOptions): Promise<void> {
        for (const packet of Protocol.initialise) await this.sendAndAwaitReply(packet);
    }

    async printPage(page: UniversalPage): Promise<void> {
        const raster = encodeRotatedRaster(singlePlane(page), this.getCapabilities().canvasHeightPx);
        await this.write(Protocol.rasterHeader(raster.widthBytes, raster.rows));
        await this.sendChunked(raster.data);
    }

    async printEnd(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.write(Protocol.feed);
        await new Promise(resolve => setTimeout(resolve, 50));
        await this.write(Protocol.feed);
    }

    private matchModel(): P12Model {
        if (['A30', ...A30_BROADCAST_PREFIXES].some(p => this.deviceName.startsWith(p))) return MODELS[2];
        if (['P12 PRO', 'P12PRO', ...P12_PRO_BROADCAST_PREFIXES].some(p => this.deviceName.startsWith(p))) return MODELS[1];
        return MODELS[0];
    }

    private requireTransport(): IDeviceTransport {
        if (!this.transport) throw new Error('Phomemo P12 transport is not bound.');
        return this.transport;
    }

    private async write(data: Uint8Array): Promise<void> {
        await this.requireTransport().write(data, { serviceUUID: SERVICE, writeUUID: WRITE});
    }

    private async sendAndAwaitReply(data: Uint8Array): Promise<void> {
        if (!this.notificationsAvailable) {
            await this.write(data);
            await new Promise(resolve => setTimeout(resolve, 100));
            return;
        }
        const transport = this.requireTransport();
        await new Promise<void>((resolve, reject) => {
            const finish = () => {
                clearTimeout(timer);
                transport.off('data', onData);
                resolve();
            };
            const onData = () => finish();
            const timer = setTimeout(finish, 500);
            transport.on('data', onData);
            this.write(data).catch(error => {
                clearTimeout(timer);
                transport.off('data', onData);
                reject(error);
            });
        });
    }

    private async sendChunked(data: Uint8Array): Promise<void> {
        for (let offset = 0; offset < data.length; offset += 128) {
            await this.write(data.slice(offset, offset + 128));
            if (offset + 128 < data.length) await new Promise(resolve => setTimeout(resolve, 20));
        }
    }
}

