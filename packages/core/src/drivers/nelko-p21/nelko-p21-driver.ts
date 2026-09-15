import type { IDeviceTransport } from '../../core/transports/transport.interface';
import type {
    IPrinterDriver,
    PrinterCapabilities,
    PrinterModelProfile,
    UniversalPrintOptions,
    ConnectionHints,
} from '../driver.interface';
import { singlePlane, type UniversalPage } from '../../types/ink';
import { encodeNelkoRaster } from './nelko-p21-raster';
import {
    bitmapHeader,
    cancelPause,
    clear,
    density,
    direction,
    gap,
    isNelkoP21Compatible,
    NELKO_P21_GEOMETRY,
    NELKO_P21_MODELS,
    NELKO_P21_NAME_PATTERNS,
    NELKO_P21_PROFILE,
    print,
    rasterTerminator,
    size,
} from './nelko-p21-protocol';

const HEAD_DOTS = NELKO_P21_GEOMETRY.headDots;
const DPMM = NELKO_P21_GEOMETRY.dpmm;
const DEFAULT_GAP_MM = 2;
const DEFAULT_LABEL_LENGTH_MM = 40;

/**
 * Clean-room driver for the Nelko P21 Bluetooth Classic label printer.
 *
 * The P21 speaks a TSPL2 command subset over an RFCOMM/SPP serial channel. It
 * is unrelated to the PeriPage raw-raster family. Each job opens with an
 * `\x1b!o` cancel-pause preamble, then a SIZE/GAP/DIRECTION/DENSITY/CLS/BITMAP
 * sequence, and commits with PRINT. Proprietary BATTERY?/CONFIG? queries are
 * out of scope for printing.
 */
export class NelkoP21Driver implements IPrinterDriver {
    readonly id = 'nelko-p21';
    readonly name = 'Nelko P21 (TSPL2)';
    readonly driverType = 'hardware' as const;
    readonly app = 'Nelko';
    readonly replacesApps = ['Nelko'] as const;
    readonly defaultKind = 'label' as const;
    readonly supportedKinds = ['label'] as const;
    readonly supportedTransports = ['bluetooth-classic', 'usb-serial'] as const;
    readonly connectionRequirements = {
        services: [] as string[],
        namePrefixes: [...NELKO_P21_NAME_PATTERNS],
    };
    readonly supportedModels: PrinterModelProfile[] = NELKO_P21_MODELS;
    readonly connectionHints: ConnectionHints = {
        bluetoothClassicHint: 'Pair your Nelko P21 in your OS Bluetooth settings, then select its serial port (COM/N /dev/rfcommN / /dev/cu.*). Web Bluetooth cannot connect to it.',
        windowsClassicHint: 'Pair the Nelko P21 in Windows Bluetooth settings; it appears as an outgoing SPP COM port.',
    };

    private transport?: IDeviceTransport;
    private activeProfile: PrinterModelProfile = NELKO_P21_PROFILE;
    private currentOptions?: UniversalPrintOptions;
    private jobActive = false;

    setProfile(profile: PrinterModelProfile): void {
        const isKnown = NELKO_P21_MODELS.some(m => m.id === profile.id);
        if (!isKnown) {
            throw new Error(`Profile ${profile.id} (${profile.model}) is not supported by the Nelko P21 (TSPL2) driver.`);
        }
        this.activeProfile = profile;
    }

    getProfile(): PrinterModelProfile {
        return this.activeProfile;
    }

    isCompatible(deviceName: string): boolean {
        return isNelkoP21Compatible(deviceName);
    }

    async bindTransport(transport: IDeviceTransport): Promise<void> {
        this.transport = transport;
    }

    async unbindTransport(): Promise<void> {
        this.transport = undefined;
        this.jobActive = false;
        this.currentOptions = undefined;
    }

    getCapabilities(): PrinterCapabilities {
        return { ...this.activeProfile.capabilities, driverId: this.id, driverName: this.name };
    }

    /**
     * Records the print options. The TSPL2 job sequence is emitted in
     * {@link printPage} so the SIZE/GAP/BITMAP header can carry the resolved
     * media geometry alongside the raster, matching how the device consumes
     * a single contiguous job.
     */
    async printInit(options: UniversalPrintOptions): Promise<void> {
        this.currentOptions = options;
        this.jobActive = true;
    }

    async printPage(page: UniversalPage): Promise<void> {
        const options = this.currentOptions ?? { density: 8, copies: 1 };
        if (!this.jobActive) {
            await this.printInit(options);
        }
        const image = singlePlane(page);
        const raster = encodeNelkoRaster(image, HEAD_DOTS);

        const paper = options.paper;
        const widthMm = paper?.tapeWidthMm ?? (raster.widthBytes * 8) / DPMM;
        const heightMm = paper?.labelLengthMm ?? Math.max(raster.rows / DPMM, DEFAULT_LABEL_LENGTH_MM);
        const gapMm = paper?.type === 'continuous' ? 0 : (paper?.gapMm ?? DEFAULT_GAP_MM);
        const densityLevel = Math.max(0, Math.min(NELKO_P21_GEOMETRY.maxDensity, Math.round(options.density ?? 8)));
        const copies = Math.max(1, Math.round(options.copies ?? 1));

        await this.send(cancelPause());
        await this.send(size(widthMm, heightMm));
        await this.send(gap(gapMm));
        await this.send(direction(1, 1));
        await this.send(density(densityLevel));
        await this.send(clear());
        await this.send(bitmapHeader(0, 0, raster.widthBytes, raster.rows));
        await this.sendChunked(raster.data);
        await this.send(rasterTerminator());
        await this.send(print(copies));
    }

    async printEnd(): Promise<void> {
        this.jobActive = false;
        this.currentOptions = undefined;
    }

    private requireTransport(): IDeviceTransport {
        if (!this.transport) throw new Error('Nelko P21 transport is not bound.');
        return this.transport;
    }

    private async send(data: Uint8Array): Promise<void> {
        await this.requireTransport().write(data);
    }

    private async sendChunked(data: Uint8Array): Promise<void> {
        const transport = this.requireTransport();
        for (let offset = 0; offset < data.length; offset += 512) {
            await transport.write(data.slice(offset, offset + 512));
            if (offset + 512 < data.length) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    }
}

export { NELKO_P21_MODELS } from './nelko-p21-protocol';
