import type { IDeviceTransport } from '../../core/transports/transport.interface';
import type { IPrinterDriver, PrinterCapabilities, PrinterModelProfile, UniversalPrintOptions, ConnectionHints } from '../driver.interface';
import { singlePlane, type UniversalPage } from '../../types/ink';
import * as Protocol from './protocol';
import { rotateToPrintRows } from './raster';

const SERVICE = '0000ae30-0000-1000-8000-00805f9b34fb';
const SERVICE_ALT = '0000ae00-0000-1000-8000-00805f9b34fb';
const SERVICE_FF00 = '0000ff00-0000-1000-8000-00805f9b34fb';
const SERVICE_AB00 = '0000ab00-0000-1000-8000-00805f9b34fb';
const WRITE = '0000ae01-0000-1000-8000-00805f9b34fb';
const NOTIFY = '0000ae02-0000-1000-8000-00805f9b34fb';
const NOTIFY_ALT = '0000ae04-0000-1000-8000-00805f9b34fb';

const STANDARD_MODELS = [
    'GB01', 'GB02', 'GB03', 'GB04', 'GB05', 'GT01', 'GT02', 'GT04', 'GT08', 'GT09',
    'LY01', 'LY02', 'LY03', 'LY05', 'MX05', 'MX06', 'MX08', 'MX09', 'MX10', 'MX11',
    'MX12', 'MX13', 'MXTP', 'YT01', 'YT02'
] as const;
const PREFIXED_MODELS = ['JXM800', 'LP100', 'LY10', 'LY11'] as const;
const STANDARD_REBRANDS = [
    'MX01', 'MXTP-100', 'AZ-P2108X', 'PD01', 'URBANWORXKIDSCAMERA', 'CYLOBTPRINTER',
    'XOPOPPY', 'BQ01', 'BQ05', 'BQ06', 'BQ06B', 'BQ07', 'BQ7A', 'BQ7B', 'BQ08',
    'BQ95', 'BQ95B', 'BQ95C', 'BQ96', 'MXW009', 'MXW010', 'KP-IM606', 'GV-MA211', 'X6', 'K06',
    'DL_X2', 'ROSSMANN', 'TCM690464', 'SEZNIKNEO', '15P3', 'YK06', 'CPLM10', 'WQ02', 'LP6', 'XIAOWA',
    'PR02', 'PR07', 'PR30', 'PR35',
    'XW001', 'XW002', 'XW003', 'JX001', 'FL01', 'KF-5', 'SC03', 'SC04', '58P5', 'WL01', 'X5', 'X7',
    'S102', 'HD1', 'P10', 'P7', 'DY01', 'S01', 'LT01', 'GW08', 'GW09', 'PR88', 'PR89', 'X8-L', 'X8-W',
    'ZP801', 'PR893', 'A43', 'A4300', 'MPA81', 'P4', 'X9', 'MV-B530', 'QDID', 'GL-VS9', 'ZP802', 'ZPA4Z1',
    'A42II', 'A41II', 'A41III', 'X8', 'S101', 'P5AI', 'M2', 'P6', 'P7H', 'X2H', 'X102', 'X6HP', 'X5HP',
    'X7HP', 'X103H', 'X103H', 'X6H', 'X5H', 'AN01', 'CP01', 'S5A', 'P20 MAX', 'S9A', 'DY33A', 'YMS-BT01',
    'WJ-HOT-PRT', 'JRX01', 'RS9000', 'DY49', 'QDX01', 'WTS07', 'GT10', 'A200', 'X7H', 'X2H', 'X5H',
    'MTPR26BK', 'ML-MP-01', 'LUXORP.PX10', 'DTR-R0', 'X18', 'CLICK-SOUND', 'DT1-R', 'MVMT INK', '0019B-D',
    'EMX-040256', 'HT0125', 'DT1-0', '0019B-C'
] as const;

const profile = (model: string, dialect: Protocol.CatPrinterDialect): PrinterModelProfile => ({
    id: `catprinter_${model.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    brand: 'Generic Cat Printer',
    model,
    family: dialect === 'prefixed' ? 'Tiny 0x12/0x51/0x78' : 'Tiny 0x51/0x78',
    supportLevel: 'Untested',
    capabilities: {
        canvasHeightPx: 384,
        dpmm: 8,
        maxDensity: 5,
        supportsSpeedMode: true,
        colorSupport: { type: 'monochrome' },
        physical: { supportedMediaWidthsMm: 58 },
        mediaDefaults: { feedAfterMinPx: 0, feedAfterMaxPx: 500, feedAfterDefaultPx: 25 }
    },
    notes: 'Experimental community support for the common 384-dot Catprinter/Tiny BLE protocol.'
});

export const CATPRINTER_MODELS: PrinterModelProfile[] = [
    ...STANDARD_MODELS.map(model => profile(model, 'standard')),
    ...PREFIXED_MODELS.map(model => profile(model, 'prefixed'))
];

export class CatPrinterDriver implements IPrinterDriver {
    readonly id: string;
    readonly name: string;
    readonly driverType = 'hardware' as const;
    readonly app = 'Tiny Print';
    readonly replacesApps = ['Tiny Print', 'iPrint'] as const;
    readonly defaultKind = 'pocket' as const;
    readonly supportedKinds = ['pocket'] as const;
    readonly supportedTransports = ['bluetooth-le'] as const;
    readonly connectionRequirements: { services: string[]; namePrefixes: string[] };
    readonly supportedModels: PrinterModelProfile[];
    readonly connectionHints: ConnectionHints = {
        bleHint: 'Turn on your printer, click Connect, and choose your printer in the popup list (e.g. MX06, GB01).',
        bluetoothClassicHint: 'Select your printer in the list (often named "MX06", "GB01", "WalkPrint", or "Print_...").'
    };

    private transport?: IDeviceTransport;
    private activeServiceUUID: string = SERVICE;
    private paused = false;
    private resumeWaiters: Array<() => void> = [];
    private lastOptions?: UniversalPrintOptions;

    constructor(private readonly dialect: Protocol.CatPrinterDialect = 'standard') {
        const names = dialect === 'prefixed'
            ? [...PREFIXED_MODELS]
            : [...STANDARD_MODELS, ...STANDARD_REBRANDS];
        this.id = dialect === 'prefixed' ? 'catprinter-tiny-prefixed' : 'catprinter-tiny-standard';
        this.name = dialect === 'prefixed'
            ? 'Catprinter (Tiny prefixed 0x12/0x51/0x78)'
            : 'Catprinter (Tiny 0x51/0x78)';
        this.connectionRequirements = { services: [SERVICE, SERVICE_ALT, SERVICE_FF00, SERVICE_AB00], namePrefixes: names };
        this.supportedModels = CATPRINTER_MODELS.filter(model =>
            dialect === 'prefixed' ? model.family?.includes('0x12/') : !model.family?.includes('0x12/'));
    }

    isCompatible(deviceName: string): boolean {
        const upper = deviceName.trim().toUpperCase();
        return this.connectionRequirements.namePrefixes
            .some(name => upper === name || upper.startsWith(`${name}-`) || upper.startsWith(`${name}_`));
    }

    async bindTransport(transport: IDeviceTransport): Promise<void> {
        this.transport = transport;
        transport.on('data', this.handleData);
        if (transport.startNotifications) {
            for (const s of [SERVICE, SERVICE_ALT]) {
                for (const n of [NOTIFY, NOTIFY_ALT]) {
                    try {
                        await transport.startNotifications({ serviceUUID: s, notifyUUID: n });
                        this.activeServiceUUID = s;
                        return;
                    } catch {
                        // Several compatible units are effectively write-only or use alt UUIDs.
                    }
                }
            }
        }
    }

    async unbindTransport(): Promise<void> {
        this.transport?.off('data', this.handleData);
        this.transport = undefined;
        this.activeServiceUUID = SERVICE;
        this.paused = false;
        this.releaseResumeWaiters();
    }

    getCapabilities(): PrinterCapabilities {
        return {
            canvasHeightPx: 384,
            dpmm: 8,
            maxDensity: 5,
            supportsSpeedMode: true,
            colorSupport: { type: 'monochrome' },
            physical: { supportedMediaWidthsMm: 58 },
            mediaDefaults: { feedAfterMinPx: 0, feedAfterMaxPx: 500, feedAfterDefaultPx: 25 },
            driverId: this.id,
            driverName: this.name
        };
    }

    async printInit(options: UniversalPrintOptions): Promise<void> {
        this.requireTransport();
        this.lastOptions = options;
        const density = Math.max(1, Math.min(5, Math.round(options.density || 3)));
        const energy = Math.round(0x2000 + ((density - 1) / 4) * (0xffff - 0x2000));
        await this.sendStream(Protocol.concat(
            Protocol.deviceState(this.dialect),
            Protocol.setQuality(density, this.dialect),
            Protocol.setEnergy(energy, this.dialect),
            Protocol.setPrintMode(false, this.dialect),
            Protocol.setSpeed(options.speed ?? 10, this.dialect),
            Protocol.startLattice(this.dialect)
        ));
    }

    async printPage(page: UniversalPage): Promise<void> {
        const rows = rotateToPrintRows(singlePlane(page), 384);
        const packets: Uint8Array[] = [];
        const speed = this.lastOptions?.speed ?? 10;
        rows.forEach((row, index) => {
            packets.push(Protocol.printLine(row, this.dialect));
            if ((index + 1) % 200 === 0) packets.push(Protocol.setSpeed(speed, this.dialect));
        });
        await this.sendStream(Protocol.concat(...packets));
    }

    async printEnd(): Promise<void> {
        const overrideMm = this.lastOptions?.feedOverrides?.feedAfterMm;
        const feedDots = typeof overrideMm === 'number' ? Math.round(overrideMm * 8) : 25;
        await this.sendStream(Protocol.concat(
            Protocol.feed(feedDots, this.dialect),
            Protocol.setPaper(this.dialect), Protocol.setPaper(this.dialect), Protocol.setPaper(this.dialect),
            Protocol.endLattice(this.dialect),
            Protocol.deviceState(this.dialect)
        ));
    }

    private requireTransport(): IDeviceTransport {
        if (!this.transport) throw new Error('Catprinter transport is not bound.');
        return this.transport;
    }

    private async sendStream(data: Uint8Array): Promise<void> {
        const transport = this.requireTransport();
        for (let offset = 0; offset < data.length; offset += 100) {
            await this.waitUntilResumed();
            await transport.write(data.slice(offset, offset + 100), { serviceUUID: this.activeServiceUUID, writeUUID: WRITE });
            if (offset + 100 < data.length) await new Promise(resolve => setTimeout(resolve, 5));
        }
    }

    private handleData = (data: Uint8Array): void => {
        const hex = [...data].map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (hex.includes('5178ae0101001070ff')) this.paused = true;
        else if (hex.includes('5178ae0101000000ff')) {
            this.paused = false;
            this.releaseResumeWaiters();
        }
    };

    private async waitUntilResumed(): Promise<void> {
        if (!this.paused) return;
        await new Promise<void>((resolve, reject) => {
            const done = () => { clearTimeout(timeout); resolve(); };
            const timeout = setTimeout(() => {
                const index = this.resumeWaiters.indexOf(done);
                if (index >= 0) this.resumeWaiters.splice(index, 1);
                reject(new Error('Catprinter flow control remained paused for 10 seconds.'));
            }, 10_000);
            this.resumeWaiters.push(done);
        });
    }

    private releaseResumeWaiters(): void {
        for (const resolve of this.resumeWaiters.splice(0)) resolve();
    }
}
