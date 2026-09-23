import { IPrinterDriver, PrinterCapabilities, UniversalPrintOptions, PrinterModelProfile, ConnectionHints } from '../driver.interface';
import { singlePlane, type UniversalPage } from '../../types/ink';
import { IDeviceTransport } from '../../core/transports/transport.interface';
import * as Protocol from './protocol';
import { encodeRaster, encodeRasterGsV0 } from './raster';
import { MarklifeFlowControl } from "./marklife-flow-control";
import type { PrinterStatus, StatusField, PrinterFault } from '../printer-status';
import { PrinterError, toPrinterError } from '../printer-error';

export interface DeviceProfile {
    prefixes: string[];
    canvasHeightPx: number;
}

export const MARKLIFE_PROFILES: DeviceProfile[] = [
    { prefixes: ['P80', 'P80S', 'L80', 'A80', 'A81', 'MT81', 'MT82', 'GD985', 'Y810', 'D400'], canvasHeightPx: 576 },
    { prefixes: ['P50', 'P50S', 'D50', 'M57', 'S8', 'L50', 'X2', 'S2', 'SB_S2', 'Jammuk_S2', 'LPW40', 'DPS1', 'PPS1', 'LuckP_D1', 'LuckP_S1', 'LuckP_A2', 'DP_S1', 'DP_D1'], canvasHeightPx: 384 },
    { prefixes: ['P11', 'P12', 'P15', 'P7', 'L12', 'L13', 'LP15', 'iSPACE-LP15', 'LP90', 'MPL10', 'MPL11', 'MPL12', 'MPL13', 'MPL15'], canvasHeightPx: 96 },
    { prefixes: ['D210', 'IP_D80', '210', 'DP_D80', 'DP_8028', 'HM-24-28', 'T3', 'ET-Z0535', 'ET-Z0537', 'X4', 'L100'], canvasHeightPx: 384 } // Assumed wide for unknown labels
];

const buildFamily = (
    brand: string,
    family: string,
    models: string[],
    baseSpec: any
) => {
    return models.map(model => ({
        id: `${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}_${model.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        brand,
        model,
        family,
        ...baseSpec
    }));
};

const marklife15mm = buildFamily('Marklife', 'Marklife 15mm Series', ['P11', 'P12', 'P15', 'P7', 'L12', 'L13', 'LP15', 'iSPACE-LP15', 'LP90'], {
    capabilities: {
        canvasHeightPx: 96,
        dpmm: 8,
        maxDensity: 15,
        supportsSpeedMode: false,
        colorSupport: { type: 'monochrome' },
        physical: { supportedMediaWidthsMm: 15 }
    },
    supportLevel: 'Untested',
});

const p12 = marklife15mm.find(m => m.model === 'P12');
if (p12) {
    p12.manualUrl = 'https://fcc.report/FCC-ID/2A2AI-P12/5793950.pdf';
    p12.capabilities = { ...p12.capabilities, physical: { ...p12.capabilities.physical, headToCutterPx: 66 } };
    p12.supportLevel = 'Tested';
    p12.connectionHints = {
        bleHint: 'Turn on your printer, click Connect, and select the device (e.g. P12_... or P12_..._BLE) in the popup list.',
        windowsClassicHint: 'Important for Windows: The P12 appears as "SPP Slave" in the Bluetooth list. Select "SPP Slave" to pair (PIN is 0000 or 1234 if prompted).',
        bluetoothClassicHint: 'Select your printer (e.g. "P12_..."). Do NOT select the entry ending in "_BLE".',
        pairingPin: '0000 or 1234'
    };
    p12.notes = `- **OEM**: Shenzhen Yinxiaoqian Technology Co., Ltd.
- **MCU**: YC3121-d
- **FCC ID**: [2A2AI-P12](https://fcc.report/FCC-ID/2A2AI-P12/)
- **Battery**: 1200mAh (18650) via Type-C
- **Print Speed**: 20mm/s
- **Dimensions**: 90 × 74 × 35 mm
- **Weight**: 250g`;
}

const p15 = marklife15mm.find(m => m.model === 'P15');
if (p15) {
    p15.manualUrl = 'https://fcc.report/FCC-ID/2A2AI-P15/7600816.pdf';
    p15.app = 'Marklife';
    p15.replacesApps = ['Marklife'];
    p15.supportLevel = 'Tested';
    p15.connectionHints = {
        bleHint: 'Turn on your printer, click Connect, and select your device (e.g. P15_... or P15_..._BLE) in the popup list.',
        bluetoothClassicHint: 'Select the entry starting with "P15_" (do NOT select "P15_..._BLE").'
    };
    p15.notes = `Driven with the manufacturer's \`10 FF\` job framing (\`10 FF F1 02\` \u2026 \`10 FF F1 45\`)
and an uncompressed \`GS v 0\` raster, which is exactly what the official Marklife app sends to this model.`;
}

const lp90 = marklife15mm.find(m => m.model === 'LP90');
if (lp90) {
    // Korean-market 15 mm unit. The manufacturer's own app files it with the
    // P12 everywhere that matters — same 96-dot head, same label sizes, same
    // density table — but drives it through its older `10 FF` command path
    // (see MARKLIFE_10FF_PREFIXES below) rather than the P12's 1F job control.
    // A Marklife-family model driven by the Marklife app, not the Lidl Pocket
    // Printer app, so scope it away from the L13's app override.
    lp90.app = 'Marklife';
    lp90.replacesApps = ['Marklife'];
    lp90.notes = `Sold in Korea; the manufacturer's app treats it as a P12-class 96-dot printer.

Driven with the manufacturer's legacy job framing (\`10 FF F1 02\` … \`10 FF F1 45\`)
and an uncompressed \`GS v 0\` raster, which is exactly what the official app sends
to this model.`;
}

// The 0x10ff driver default app is Pocket Printer (the Lidl/L13 path), but
// every other 0x10ff model is a Marklife-family unit driven by the Marklife
// app. Without an explicit override each would inherit the driver-level app
// and be listed under Pocket Printer. Scope them here so only the L13 maps to
// the Karsten / Lidl Pocket Printer app.
for (const m of marklife15mm) {
    if (m.model === 'L13') continue;
    if (!m.app) {
        m.app = 'Marklife';
        m.replacesApps = ['Marklife'];
    }
}
const l13 = marklife15mm.find(m => m.model === 'L13');
if (l13) {
    // Rebadged 15 mm unit sold under several house brands and identified by the
    // `L13_..._BLE` device name.
    l13.manualUrl = 'https://manuals.plus/munbyn/l13-label-printer-manual';
    // Confirmed working against a real unit over the legacy job path the
    // official app and the original BleWebler both use (see
    // MARKLIFE_10FF_PREFIXES). The standard `1F` job framing prints nothing on
    // some firmware revisions.
    l13.supportLevel = 'Tested';
    // Marklife appears to be the OEM's own brand, but they do not sell an L13
    // under it — every unit reaches buyers rebadged. It sits in this driver
    // because it speaks this driver's protocol, not because it is a Marklife
    // product.
    l13.rebadgeOnly = true;
    // The retail names, in full, exactly as they appear on the products. Listed
    // here rather than only in the prose below so the table can find this
    // printer by any of them — and full names cost nothing for search, since
    // matching is on substrings: "munbyn", "silvercrest" and "l13" all hit.
    //
    // Note the Lidl one carries no model number at retail; `L13` is what the
    // firmware answers, which is why the row is filed under it.
    l13.aliases = [
        'Silvercrest Thermo Label Printer',
        'MUNBYN L13 Label Printer',
        'Luckjingle L13 Mini Label Maker',
        'DP-L13',
        'Silvercrest DP-L13',
        'Pocket Printer L13',
        'Karsten International',
        'Karsten Pocket Printer',
        'Crafts&Co',
        'Fichero'
    ];
    l13.app = 'Pocket Printer';
    l13.replacesApps = ['Pocket Printer', 'Pocket Print'];
    l13.kind = 'label';
    l13.supportedKinds = ['label'];
    l13.supportedTransports = ['bluetooth-le', 'bluetooth-classic', 'usb-serial'];
    l13.connectionHints = {
        bleHint: 'Turn on your printer, click Connect, and select your device (e.g. L13_... or L13_..._BLE) in the popup list.',
        bluetoothClassicHint: 'Select the entry starting with "L13_" (do NOT select "L13_..._BLE").'
    };
    l13.notes = `One printer sold under several names, none of them Marklife's own.
If a label maker is 15 mm, 203 dpi and answers to \`L13\` or \`DP-L13\`, it is very likely this
machine whatever the box says.

The companion app is "Pocket Printer" by Karsten International B.V. (often sold at Action or Lidl under
Silvercrest, Crafts&Co, or Fichero brands). The app offers two device choices:
1. "Label Printer" — this 15 mm Marklife-legacy L13 unit.
2. "Pocket Printer" — a wider continuous 58 mm thermal pocket printer.

The Silvercrest version is Lidl's house brand and carries no model number on the
packaging; \`DP-L13\` is what the firmware reports.

> **No cutter**, despite the product photography. Listings for every brand show
> a cutter lever, and the shipped hardware does not have one — tear the label
> against the edge instead.

**Hardware**
- **MCU**: YiChip YC3121-D
- **Resolution**: 203 dpi (8 dots/mm), 96 px print width
- **Media**: 15 mm max tape; 14 × 30 mm labels typical
- **Battery**: 1200 mAh Li-Ion, USB-C
- **Print speed**: 20 mm/s
- **LEDs**: green — charged / normal; blue — charging or Bluetooth connected;
  red — cover open, out of paper, or charging; red flashing — low power

**Certification** — two FCC ids appear against Silvercrest-branded units and
this has not been reconciled; both are recorded rather than one guessed at:
- [2A6FW-L13](https://fcc.report/FCC-ID/2A6FW-L13/) (Xiamen Print Future Technology Co., Ltd.)
- [2BHE2-KS4732](https://fcc.report/FCC-ID/2BHE2-KS4732/) (KARSTEN INTERNATIONAL BV)

**Protocol** — status queries (battery, paper, hardware/firmware/serial)
use the shared 10 FF INFO family, fully supported. Print jobs use the
legacy 10 FF F1 02 job framing with an uncompressed GS v 0 raster
(10 FF F1 45 to close), matching the official Pocket Printer app and the
original BleWebler, not the P12's 1F job control — which connects but
produces no output on some firmware revisions.`;
}

const marklife48mm = buildFamily('Marklife', 'Marklife 48mm Series', ['P50', 'P50S', 'D50', 'M57', 'S8', 'L50', 'X2', 'S2', 'SB_S2', 'Jammuk_S2', 'LPW40'], {
    capabilities: { canvasHeightPx: 384, dpmm: 8, maxDensity: 15, supportsSpeedMode: true, colorSupport: { type: 'monochrome' }, physical: { supportedMediaWidthsMm: { min: 20, max: 50 } } },
    supportLevel: 'Untested'
});

const marklife72mm = buildFamily('Marklife', 'Marklife 72mm Series', ['P80', 'P80S', 'L80'], {
    capabilities: {
        canvasHeightPx: 576,
        dpmm: 8,
        maxDensity: 15,
        supportsSpeedMode: true,
        colorSupport: { type: 'monochrome' },
        physical: { supportedMediaWidthsMm: { min: 20, max: 80 } }
    },
    supportLevel: 'Untested'
});

const marklifeOEM = buildFamily('Marklife', 'Marklife OEM / Unknown', ['LuckP_D1', 'D210', 'IP_D80', '210', 'DP_D80', 'DP_8028', 'HM-24-28', 'T3', 'ET-Z0535', 'ET-Z0537', 'X4', 'L100', 'M1', 'P1S', 'A50', 'D200', 'LPC74', 'D100'], {
    capabilities: {
        canvasHeightPx: 384,
        dpmm: 8,
        maxDensity: 15,
        supportsSpeedMode: true,
        colorSupport: { type: 'monochrome' },
        physical: {  }
    },
    supportLevel: 'Untested'
});

export const MARKLIFE_HARDWARE_MODELS = [
    ...marklife15mm,
    ...marklife48mm,
    ...marklife72mm,
    ...marklifeOEM
];

// Models with dedicated schematic artwork are registered by the artwork module;
// the UI uses its neutral fallback for all other models.

/**
 * Models the manufacturer's app drives through its `10 FF` path instead of
 * the `1F` job framing: a 15-byte wake-up, `10 FF F1 02` to open the job, an
 * uncompressed `GS v 0` raster, `1D 0C` (gap) or `1B 4A n` (continuous) to
 * position the label, and `10 FF F1 45` to close. None of the `1F 80`, `1F C0`,
 * `1F 11` or `1F 70` commands are sent to these models by the official app.
 *
 * The L13 is included here because the official Pocket Printer app (and the
 * original BleWebler, which prints on this model) drive it with exactly this
 * legacy sequence. The `1F` job framing the standard path uses does not print
 * on some L13 firmware revisions: the device accepts the connection and
 * reports status, but produces no output.
 *
 * Matched on the advertised name prefix, the same way the official app does.
 */
export const MARKLIFE_10FF_PREFIXES = [
    'LP90', 'L13', 'DP-L13', 'SILVERCREST', 'MUNBYN', 'LUCKJINGLE',
    'LUCKP_', 'DP_', 'APL', 'MPL', 'LPD', 'PPL', 'L12', 'PPS1', 'BTW',
    'P15', 'P15_', 'P15R', 'P15S', 'P11', 'P7', 'LP15'
];

// The profile list also powers the disconnected preview. Keep its continuous
// feed defaults in step with getCapabilities() for every model, not just P12.
for (const model of MARKLIFE_HARDWARE_MODELS) {
    const offset = model.capabilities.physical?.headToCutterPx;
    const legacy = MARKLIFE_10FF_PREFIXES.some(prefix => model.model.toUpperCase().includes(prefix));
    model.capabilities.mediaDefaults = {
        feedBeforeMinPx: 0, feedBeforeMaxPx: 255, feedBeforeDefaultPx: 0,
        feedAfterMinPx: offset ?? 0, feedAfterMaxPx: 255,
        feedAfterDefaultPx: offset !== undefined ? 2 * offset : legacy ? 91 : 66
    };
}

export type MarklifeDialect = 'auto' | '0x1f' | '0x10ff';

/**
 * Marklife's `0x1F` protocol, and the `10 FF` INFO command family beside it.
 *
 * The INFO commands are not specific to one model — the same bytes answer on a
 * P12 and on an L13, which is sold under half a dozen brand names and behaves
 * essentially identically. Nothing guarantees that holds for the next printer,
 * so a model that ignores one of these is behaving normally, and every query
 * here tolerates silence rather than treating it as a fault.
 *
 *     10 FF 20 EF   hardware version
 *     10 FF 20 F0   model / name
 *     10 FF 20 F1   firmware version
 *     10 FF 20 F2   serial number
 *     10 FF 50 F1   battery, percentage in the second byte
 *     10 FF 40      paper, 0x00 present / 0x04 absent
 *     10 FF 10 00 n print density  (0 light, 1 medium, 2 thick)
 *     10 FF 12 00 n auto-shutdown timeout, minutes
 *
 * The last two are not wired up: this driver sets density through the `0x1F`
 * print path already, and nothing in the app has a reason to change a
 * printer's power-saving setting.
 */
export class MarklifeDriver implements IPrinterDriver {
    public readonly name: string;
    public readonly id: string;
    public readonly driverType = 'hardware' as const;

    // The Universal Print Manager will request these services
    public readonly connectionRequirements: {
        services: string[];
        namePrefixes?: string[];
    };

    // Offline simulation profiles. Values mirror the live getCapabilities() of
    // this driver so the disconnected/simulated caps and the connected caps
    // agree (density range, head-to-cutter distance, etc.).
    public readonly supportedModels: PrinterModelProfile[];
    public readonly app: string;
    public readonly replacesApps: readonly string[];
    public readonly defaultKind = 'label' as const;
    public readonly supportedKinds = ['label'] as const;
    public readonly supportedTransports = ['bluetooth-le', 'bluetooth-classic', 'usb-serial'] as const;

    public readonly connectionHints: ConnectionHints = {
        bleHint: 'Turn on your printer, click Connect, and select your device in the popup list.',
        bluetoothClassicHint: 'Select your Marklife printer in the list. Do NOT select the entry ending in "_BLE".'
    };

    /**
     * No `'media'`: nothing in this protocol says what stock is loaded, only
     * whether *any* is. Claiming it would leave a permanently empty row.
     */
    public readonly reports = [
        'battery', 'faults', 'deviceName', 'serialNumber',
        'firmwareVersion', 'hardwareVersion'
    ] as const satisfies readonly StatusField[];

    private transport: IDeviceTransport | null = null;
    private flowControl = new MarklifeFlowControl();
    private writeCharacteristicId: string | null = null;
    private hasFlowControl = false;
    private lastOptions: UniversalPrintOptions | null = null;
    private detectedModel: string | null = null;

    constructor(public readonly dialect: MarklifeDialect = 'auto') {
        this.name = dialect === '0x10ff' ? "Marklife-0x10FF" : "Marklife-0x1F";
        this.id = dialect === '0x10ff' ? 'marklife-0x10ff' : 'marklife-0x1f';
        this.app = dialect === '0x10ff' ? 'Pocket Printer' : 'Marklife';
        this.replacesApps = dialect === '0x10ff' ? ['Pocket Printer', 'Pocket Print'] : ['Marklife'];
        const isLegacy = (m: PrinterModelProfile) =>
            m.model === 'L13' || m.model === 'L12' || m.model === 'LP90' ||
            m.model === 'P15' || m.model === 'P11' || m.model === 'P7' || m.model === 'LP15' ||
            m.id === 'marklife_l13' || m.id === 'marklife_l12' || m.id === 'marklife_lp90' ||
            m.id === 'marklife_p15' || m.id === 'marklife_p11' || m.id === 'marklife_p7' || m.id === 'marklife_lp15';
        if (dialect === '0x10ff') {
            this.supportedModels = MARKLIFE_HARDWARE_MODELS.filter(isLegacy);
            this.connectionRequirements = {
                services: [
                    '0000ff00-0000-1000-8000-00805f9b34fb',
                    '49535343-fe7d-4ae5-8fa9-9fafd205e455'
                ],
                namePrefixes: [...MARKLIFE_10FF_PREFIXES]
            };
        } else {
            this.supportedModels = MARKLIFE_HARDWARE_MODELS.filter(m => !isLegacy(m));
            this.connectionRequirements = {
                services: [
                    '0000ff00-0000-1000-8000-00805f9b34fb',
                    '49535343-fe7d-4ae5-8fa9-9fafd205e455'
                ],
                namePrefixes: [
                    ...MARKLIFE_PROFILES.flatMap(p => p.prefixes).filter(p => !MARKLIFE_10FF_PREFIXES.includes(p.toUpperCase())),
                    'Marklife', 'P12_'
                ]
            };
        }
    }

    public setModel(model: string): void {
        const lower = model.toLowerCase();
        const found = MARKLIFE_HARDWARE_MODELS.find(
            m => m.id.toLowerCase() === lower ||
                 m.model.toLowerCase() === lower ||
                 (m.aliases && (m.aliases as string[]).some(a => a.toLowerCase().includes(lower) || lower.includes(a.toLowerCase())))
        );
        this.detectedModel = found ? found.model : model;
    }

    /** Convert a millimetre feed distance to printer dots (8 dpmm). */
    private mmToDots(mm: number): number {
        return Math.max(0, Math.round(mm * 8));
    }

    /** True for models on the manufacturer's `10 FF` command path. */
    private uses10FF(): boolean {
        if (this.dialect === '0x10ff') return true;
        if (this.dialect === '0x1f') return false;

        const names = [
            this.detectedModel,
            this.transport?.getDeviceName()
        ].filter(Boolean).map(n => n!.toUpperCase());

        return MARKLIFE_10FF_PREFIXES.some(prefix =>
            names.some(name => name.includes(prefix))
        );
    }

    /**
     * The legacy job-enable code a model answers. Most of the family takes
     * `02` (confirmed on the LP90 and what the original BleWebler sends); the
     * L13 is driven with `03` by the official Pocket Printer app and by the
     * standalone test pages that print on it.
     */
    private legacyEnableByte(): number {
        const names = [
            this.detectedModel,
            this.transport?.getDeviceName()
        ].filter(Boolean).map(n => n!.toUpperCase());
        return names.some(n =>
            n.includes('L13') ||
            n.includes('SILVERCREST') ||
            n.includes('MUNBYN') ||
            n.includes('LUCKJINGLE') ||
            n.includes('LUCKP_') ||
            n.includes('DP_') ||
            n.includes('APL') ||
            n.includes('MPL') ||
            n.includes('LPD') ||
            n.includes('PPL') ||
            n.includes('L12') ||
            n.includes('PPS1') ||
            n.includes('BTW')
        ) ? 0x03 : 0x02;
    }

    /** Concatenate command fragments into one job buffer. */
    private static concat(...parts: Uint8Array[]): Uint8Array {
        const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
        let offset = 0;
        for (const part of parts) { out.set(part, offset); offset += part.length; }
        return out;
    }
    private dataListener: ((data: Uint8Array, characteristicId?: string) => void) | null = null;

    public isCompatible(deviceName: string): boolean {
        const upper = deviceName.toUpperCase();

        if (this.dialect === '0x10ff') {
            return MARKLIFE_10FF_PREFIXES.some(prefix => upper.includes(prefix));
        }

        const isLegacyModel = MARKLIFE_10FF_PREFIXES.some(prefix => upper.includes(prefix));
        if (isLegacyModel) {
            return false;
        }

        const lower = deviceName.toLowerCase();

        if (lower.includes('marklife') || lower.startsWith('p12_')) {
            return true;
        }

        // Match any of the known prefixes
        for (const profile of MARKLIFE_PROFILES) {
            for (const prefix of profile.prefixes) {
                if (lower.includes(prefix.toLowerCase())) {
                    return true;
                }
            }
        }

        return false;
    }

    public async bindTransport(transport: IDeviceTransport): Promise<void> {
        this.transport = transport;

        // Store listener reference so we can remove it on unbind
        this.dataListener = (data: Uint8Array, characteristicId?: string) => {
            // Check if it's the Flow Control characteristic 'ff03', or if missing (like on USB)
            if (!characteristicId || characteristicId.toLowerCase().includes('ff03')) {
                this.flowControl.handleNotification(data);
            }
        };
        this.transport.on('data', this.dataListener);

        // The Transport abstraction might not give us direct list of characteristics,
        // so we assume standard IDs for Marklife
        this.writeCharacteristicId = '0000ff02-0000-1000-8000-00805f9b34fb';
        const notifyCharacteristicId = '0000ff03-0000-1000-8000-00805f9b34fb';

        const isSerialOrUsb = transport.filterType === 'usb' 
            || (transport.type && (transport.type.toLowerCase().includes('serial') || transport.type.toLowerCase().includes('usb')));

        if (this.transport.startNotifications) {
            await this.transport.startNotifications({
                serviceUUID: this.connectionRequirements.services[0],
                notifyUUID: notifyCharacteristicId
            });
            this.hasFlowControl = !isSerialOrUsb;
        } else {
            this.hasFlowControl = false;
        }

        this.flowControl.reset();
    }

    public async unbindTransport(): Promise<void> {
        if (this.transport && this.dataListener) {
            this.transport.off('data', this.dataListener);
        }
        this.dataListener = null;
        this.transport = null;
        this.writeCharacteristicId = null;
        this.hasFlowControl = false;
        this.detectedModel = null;
        this.flowControl.reset();
    }

    public getCapabilities(): PrinterCapabilities {
        const candidateName = this.detectedModel || this.transport?.getDeviceName() || "";
        const deviceName = candidateName.toLowerCase();

        // Default to P12 size (96) if no profile matches
        let canvasHeightPx = 96;

        for (const profile of MARKLIFE_PROFILES) {
            if (profile.prefixes.some(prefix => deviceName.includes(prefix.toLowerCase()))) {
                canvasHeightPx = profile.canvasHeightPx;
                break;
            }
        }

        // Read geometry and feed defaults from the matched model so connected
        // printing and the disconnected preview use the same values.
        const matched = MARKLIFE_HARDWARE_MODELS.find(
            m => deviceName.includes(m.model.toLowerCase()) ||
                 deviceName.includes(m.id.toLowerCase()) ||
                 (m.aliases && (m.aliases as string[]).some(a => deviceName.includes(a.toLowerCase()) || a.toLowerCase().includes(deviceName)))
        );

        const mediaDefaults = matched?.capabilities.mediaDefaults ?? {
            feedBeforeMinPx: 0, feedBeforeMaxPx: 255, feedBeforeDefaultPx: 0,
            feedAfterMinPx: 0, feedAfterMaxPx: 255,
            feedAfterDefaultPx: this.uses10FF() ? 91 : 66
        };

        return {
            maxDensity: 15,
            canvasHeightPx,
            supportsSpeedMode: matched?.capabilities.supportsSpeedMode ?? true,
            colorSupport: { type: 'monochrome' },
            dpmm: 8,
            driverId: this.id,
            driverName: this.uses10FF()
                ? "Marklife (0x10FF)"
                : "Marklife (0x1F)",
            // `?? {}` rather than a default offset: an unrecognised printer has
            // an unknown cutter distance, and inventing one puts the tear in
            // the wrong place on every label it prints.
            physical: matched?.capabilities.physical ?? {},
            mediaDefaults
        };
    }

    private feedDots(which: 'before' | 'after'): number {
        const defaults = this.getCapabilities().mediaDefaults!;
        const mm = which === 'before'
            ? this.lastOptions?.feedOverrides?.feedBeforeMm
            : this.lastOptions?.feedOverrides?.feedAfterMm;
        const fallback = which === 'before' ? defaults.feedBeforeDefaultPx! : defaults.feedAfterDefaultPx!;
        const minimum = which === 'before' ? defaults.feedBeforeMinPx! : defaults.feedAfterMinPx!;
        const requested = typeof mm === 'number' && Number.isFinite(mm) ? this.mmToDots(mm) : fallback;
        return Math.min(255, Math.max(minimum, requested));
    }

    private async sendCommand(cmd: Uint8Array): Promise<void> {
        if (!this.transport || !this.writeCharacteristicId) throw new Error("Transport not bound");
        await this.transport.write(cmd, {
            serviceUUID: this.connectionRequirements.services[0],
            writeUUID: this.writeCharacteristicId,
        });
        // Small delay to ensure command is processed by firmware
        await new Promise(r => setTimeout(r, 60));
    }

    /**
     * Battery, paper, identity and versions, read over the vendor INFO service.
     *
     * **One question at a time.** The replies arrive as unsolicited
     * notifications carrying no tag saying which question they answer, so the
     * only thing tying an answer to its query is that nothing else was in
     * flight. Queries therefore run sequentially with an individual timeout,
     * so a dropped reply cannot shift later values onto the wrong fields.
     */
    private async askInfo(packet: number[], timeoutMs = 300): Promise<Uint8Array | undefined> {
        const INFO_SERVICE = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
        const WRITE_CHAR = "49535343-8841-43f4-a8d4-ecbe34729bb3";
        const NOTIFY_CHAR = "49535343-1e4d-4bd9-ba61-23c647249616";
        const transport = this.transport;
        if (!transport) throw new PrinterError('not-connected', 'Printer not connected.');

        return new Promise<Uint8Array | undefined>((resolve, reject) => {
            const onData = (data: Uint8Array, charId?: string) => {
                const id = charId?.toLowerCase();
                const mine = !id
                    || id === NOTIFY_CHAR.replace(/-/g, '').toLowerCase()
                    || id.includes('1e4d'); // shortened/normalised UUID forms
                if (!mine) return;
                // Flow control notifications (0xFF03) are [0x01, credits]. Ignore them here.
                if (data.length === 2 && data[0] === 0x01) return;

                clearTimeout(timer);
                transport.off('data', onData);
                resolve(new Uint8Array(data));
            };
            const timer = setTimeout(() => {
                transport.off('data', onData);
                // Undefined, not a rejection: a printer that does not implement
                // a query is normal, and one unanswered question must not throw
                // away the answers to the other five.
                resolve(undefined);
            }, timeoutMs);
            transport.on('data', onData);
            transport.write(new Uint8Array(packet), {
                serviceUUID: INFO_SERVICE,
                writeUUID: WRITE_CHAR,
                writeMode: 'with-response'
            }).catch(err => {
                clearTimeout(timer);
                transport.off('data', onData);
                reject(toPrinterError(err, 'transport'));
            });
        });
    }

    public async getStatus(): Promise<PrinterStatus> {
        if (!this.transport) {
            throw new PrinterError('not-connected', 'Printer not connected.');
        }

        try {
            if (this.transport.startNotifications) {
                await this.transport.startNotifications({
                    serviceUUID: "49535343-fe7d-4ae5-8fa9-9fafd205e455",
                    notifyUUID: "49535343-1e4d-4bd9-ba61-23c647249616"
                });
            }
        } catch (err) {
            throw toPrinterError(err, 'transport');
        }

        // See the class doc for the command set.
        const battery = await this.askInfo([0x10, 0xff, 0x50, 0xf1]);
        const paper = await this.askInfo([0x10, 0xff, 0x40]);
        const hardware = await this.askInfo([0x10, 0xff, 0x20, 0xef]);
        const name = await this.askInfo([0x10, 0xff, 0x20, 0xf0]);
        const firmware = await this.askInfo([0x10, 0xff, 0x20, 0xf1]);
        const serial = await this.askInfo([0x10, 0xff, 0x20, 0xf2]);

        const decoder = new TextDecoder('utf-8');
        const text = (buf?: Uint8Array): string | undefined => {
            if (!buf) return undefined;
            const s = decoder.decode(buf).trim().replace(/\0/g, '');
            // An empty string is not a serial number. Undefined says "not
            // reported", which is what a UI needs to show a dash rather than a
            // blank that looks like a rendering bug.
            return s.length ? s : undefined;
        };

        const resolvedDeviceName = text(name);
        if (resolvedDeviceName && this.dialect === 'auto') {
            this.detectedModel = resolvedDeviceName;
        }

        const faults: PrinterFault[] = [];
        const status: PrinterStatus = {
            identity: {
                hardwareVersion: text(hardware),
                deviceName: resolvedDeviceName,
                firmwareVersion: text(firmware),
                serialNumber: text(serial)
            },
            readAt: Date.now()
        };

        if (battery && battery.length >= 2) {
            const percent = battery[1];
            // Firmware occasionally answers before it has a reading; >100 is
            // that, not a full battery.
            if (percent <= 100) {
                status.battery = { level: percent / 100 };
                if (percent <= 10) {
                    faults.push({
                        code: 'battery-critical',
                        // Printing still works down to the cut-off; warning it
                        // is. Blocking here would stop a job the printer is
                        // perfectly willing to run.
                        blocking: false,
                        message: `Battery at ${percent}%.`
                    });
                }
            }
        }

        if (paper && paper.length >= 2) {
            // 0x00 present, 0x04 absent. Only those two values are documented,
            // so anything else is left unreported rather than guessed at — an
            // invented "out of paper" would block a print that would have
            // worked.
            const flag = paper[1];
            if (flag === 0x04) {
                faults.push({ code: 'paper-out', blocking: true, raw: `10ff40=${flag}` });
            } else if (flag !== 0x00) {
                faults.push({
                    code: 'unknown',
                    blocking: false,
                    raw: `10ff40=${flag}`,
                    message: 'Printer reported an unrecognised paper state.'
                });
            }
        }

        // Only claimed when the printer actually answered the paper query: an
        // empty array means "checked, healthy", which would be a lie about a
        // model that never replied.
        if (paper || faults.length) status.faults = faults;

        return status;
    }

    public async printInit(options: UniversalPrintOptions): Promise<void> {
        this.lastOptions = options;

        if (this.uses10FF()) {
            // The official app sends no 1F-family setup to these models. Density
            // travels on the module dialect, as one of three gears.
            if (options.density) {
                await this.sendCommand(Protocol.setLegacyDensity(Protocol.legacyDensityGear(options.density)));
            }
            return;
        }
        // Anything that is not explicitly gapped is treated as continuous:
        // hunting for a gap that is not there makes the printer feed forever,
        // which is a far worse failure than printing across one.
        const media = options.paper?.type === 'gap'
            ? Protocol.MediaType.Gap
            : Protocol.MediaType.Continuous;

        await this.sendCommand(Protocol.setMediaType(media));
        await this.sendCommand(Protocol.startJob());

        if (media === Protocol.MediaType.Gap) {
            await this.sendCommand(Protocol.alignAuto(0x51));
            await new Promise(r => setTimeout(r, 100)); // wait for move
        }

        if (media === Protocol.MediaType.Continuous) {
            const beforeDots = this.feedDots('before');
            if (beforeDots > 0) await this.sendCommand(Protocol.feedDots(beforeDots));
        }

        // Set Density
        if (options.density) {
            await this.sendCommand(Protocol.setDensity(options.density));
        }

        // Set Speed
        if (options.speed !== undefined) {
            await this.sendCommand(Protocol.setSpeed(options.speed));
        }
    }

    public async printPage(page: UniversalPage): Promise<void> {
        const image = singlePlane(page);
        if (!this.transport || !this.writeCharacteristicId) throw new Error("Transport not bound");

        const { data: imageData, width, height } = image;

        const targetBufferWidth = this.getCapabilities().canvasHeightPx; // Hardware width (e.g. 96)

        // Ensure the input image is padded to match the target printhead width (Y-axis of the horizontal image)
        let finalData = imageData;
        let finalHeight = height;

        if (height !== targetBufferWidth) {
            finalHeight = targetBufferWidth;
            finalData = new Uint8Array(width * targetBufferWidth * 4);
            finalData.fill(255); // Fill with white background

            // Center the image vertically
            const yOffset = Math.floor((targetBufferWidth - height) / 2);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const srcIdx = (y * width + x) * 4;
                    const destIdx = ((y + yOffset) * width + x) * 4;
                    finalData[destIdx] = imageData[srcIdx];
                    finalData[destIdx + 1] = imageData[srcIdx + 1];
                    finalData[destIdx + 2] = imageData[srcIdx + 2];
                    finalData[destIdx + 3] = imageData[srcIdx + 3];
                }
            }
        }

        // Now we must rotate the horizontal image (Width=tape_length, Height=printhead)
        // into a vertical buffer (Width=printhead, Height=tape_length) for the hardware protocol.
        // We want columns to be printed left to right.
        // Tape feeds out: The left edge of the horizontal image (x=0) should be printed first (y=0 in hardware).
        // Therefore, hardware row Y maps to image column X.
        const hardwareWidth = finalHeight; // e.g. 96
        const hardwareHeight = width; // e.g. 227
        const hardwareData = new Uint8Array(hardwareWidth * hardwareHeight * 4);

        for (let imgY = 0; imgY < finalHeight; imgY++) {
            for (let imgX = 0; imgX < width; imgX++) {
                const srcIdx = (imgY * width + imgX) * 4;

                // Rotation mapping:
                // Hardware Y (row to print) = imgX (column of image, left to right)
                const hwY = imgX;
                // Hardware X (dot on printhead) = hardwareWidth - 1 - imgY (flip top to bottom)
                const hwX = hardwareWidth - 1 - imgY;

                const destIdx = (hwY * hardwareWidth + hwX) * 4;

                hardwareData[destIdx] = finalData[srcIdx];
                hardwareData[destIdx + 1] = finalData[srcIdx + 1];
                hardwareData[destIdx + 2] = finalData[srcIdx + 2];
                hardwareData[destIdx + 3] = finalData[srcIdx + 3];
            }
        }

        if (this.uses10FF()) {
            // One buffer, framed exactly as the manufacturer's app frames it.
            const gap = this.lastOptions?.paper?.type === 'gap';
            const beforeDots = gap ? 0 : this.feedDots('before');
            const beforeFeed = !gap && beforeDots > 0
                ? Protocol.feedDots(beforeDots)
                : new Uint8Array();
            // One trailing feed, inside the framed job, matches the known-good
            // legacy command order. printEnd must not add a second one.
            const afterDots = gap ? 0 : this.feedDots('after');
            const afterFeed = gap
                ? Protocol.gapAlign()
                : afterDots > 0 ? Protocol.feedDots(afterDots) : new Uint8Array();
            const job = MarklifeDriver.concat(
                Protocol.legacyWakeup(),
                Protocol.legacyStartJob(this.legacyEnableByte()),
                beforeFeed,
                encodeRasterGsV0({ width: hardwareWidth, height: hardwareHeight, data: hardwareData }),
                afterFeed,
                Protocol.endJobAlternate()
            );
            // The official app paces this family at 30 ms even when the BLE
            // flow-control characteristic is available.
            await this.flowControl.sendData(
                job,
                this.transport,
                this.connectionRequirements.services[0],
                this.writeCharacteristicId,
                this.hasFlowControl,
                30
            );
            return;
        }

        const raster = encodeRaster({
            width: hardwareWidth,
            height: hardwareHeight,
            data: hardwareData
        });

        // Send with flow control tracking
        await this.flowControl.sendData(
            raster,
            this.transport,
            this.connectionRequirements.services[0],
            this.writeCharacteristicId,
            this.hasFlowControl
        );
    }

    public async printEnd(): Promise<void> {
        if (!this.transport || !this.writeCharacteristicId) throw new Error("Transport not bound");

        if (this.uses10FF()) {
            // The complete legacy job, including its one trailing feed, was
            // sent by printPage.
            await new Promise(r => setTimeout(r, 300));
            this.flowControl.reset();
            return;
        }

        // Wait a small moment for the last image buffers to settle in hardware
        await new Promise(r => setTimeout(r, 200));

        const continuous = this.lastOptions?.paper?.type !== 'gap';
        if (continuous) {
            const afterDots = this.feedDots('after');
            if (afterDots > 0) await this.sendCommand(Protocol.feedDots(afterDots));
        }

        // 0x1F stop sequence
        await this.sendCommand(Protocol.endJob());

        // Alternate stop sequence required by this printer family.
        await this.sendCommand(Protocol.endJobAlternate());

        if (!continuous) {
            await this.sendCommand(Protocol.alignAuto(0x50));
        }

        // Final delay to ensure feed finishes before next job or disconnect
        await new Promise(r => setTimeout(r, 300));

        this.flowControl.reset();
    }
}
