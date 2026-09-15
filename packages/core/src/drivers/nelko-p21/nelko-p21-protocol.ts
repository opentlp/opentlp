import type { PrinterModelProfile, SupportLevel } from '../driver.interface';

/**
 * Nelko P21 transport facts.
 *
 * The P21 speaks a TSPL2-derived, line-oriented protocol over a Bluetooth
 * Classic SPP / RFCOMM serial channel (115200 baud, 8N1). It advertises no
 * GATT service that identifies it over BLE: discovery is by the paired serial
 * port name, not by a service UUID. The `service` below is therefore empty,
 * matching the other Bluetooth-Classic-only drivers.
 */
export const NELKO_P21_TRANSPORT = {
    baudRate: 115200,
} as const;

/**
 * Physical printhead geometry for the Nelko P21.
 *
 * The head carries 96 dots across a 12 mm print width at 203 dpi (8 dpmm).
 */
export const NELKO_P21_GEOMETRY = {
    headDots: 96,
    dpmm: 8,
    dpi: 203,
    maxDensity: 15,
} as const;

const UNTESTED_SUPPORT: SupportLevel = 'Untested';

/**
 * Canonical Nelko P21 model profile.
 *
 * The P21 is a 203-dpi, 96-dot Bluetooth Classic label printer unrelated to the
 * PeriPage raw-raster family; it answers a TSPL2 command subset augmented with
 * Nelko-specific proprietary queries.
 */
export const NELKO_P21_PROFILE: PrinterModelProfile = {
    id: 'nelko_p21',
    brand: 'Nelko',
    model: 'P21',
    family: 'Nelko P21 TSPL2',
    supportLevel: UNTESTED_SUPPORT,
    notes: '96-dot (12 mm) 203-dpi TSPL2-over-Bluetooth-Classic label printer. Uses a \\x1b!o cancel-pause preamble followed by SIZE/GAP/DIRECTION/DENSITY/CLS/BITMAP/PRINT. Proprietary BATTERY?/CONFIG? queries are not implemented. No Web Bluetooth support; pair over RFCOMM/SPP and select the resulting serial port.',
    capabilities: {
        maxDensity: NELKO_P21_GEOMETRY.maxDensity,
        canvasHeightPx: NELKO_P21_GEOMETRY.headDots,
        supportsSpeedMode: false,
        colorSupport: { type: 'monochrome', channels: 1 },
        dpmm: NELKO_P21_GEOMETRY.dpmm,
        driverName: 'Nelko P21 (TSPL2)',
    },
};

export const NELKO_P21_MODELS: PrinterModelProfile[] = [NELKO_P21_PROFILE];

/**
 * Advertising/serial-port name patterns that indicate a Nelko P21.
 *
 * The printer pairs as a Bluetooth Classic SPP device and surfaces as a serial
 * port whose name carries the brand or model string. Patterns are matched
 * case-insensitively against the device name.
 */
export const NELKO_P21_NAME_PATTERNS = ['Nelko', 'P21'] as const;

/**
 * Determines whether a device name indicates a Nelko P21.
 *
 * Requires an explicit Nelko brand or P21 model token. The P21 stem alone is
 * ambiguous with PeriPage's raw-raster P21, but the PeriPage driver only matches
 * PeriPage/PPG-prefixed resolution-qualified names, so a bare or Nelko-prefixed
 * P21 reaches this driver without collision.
 */
export function isNelkoP21Compatible(deviceName: string): boolean {
    if (!deviceName || typeof deviceName !== 'string') return false;
    const name = deviceName.trim().toUpperCase();
    if (!name) return false;
    return NELKO_P21_NAME_PATTERNS.some(pattern => {
        const upper = pattern.toUpperCase();
        return name === upper
            || name.includes(`${upper} `)
            || name.includes(`${upper}-`)
            || name.includes(`${upper}_`);
    });
}

/* ========================================================================= *
 * Protocol command builders
 *
 * The P21 accepts a line-oriented TSPL2 subset. ASCII commands terminate with
 * CRLF. `BITMAP` is the exception: its comma-terminated ASCII header is followed
 * immediately by `widthBytes * height` binary raster bytes, then CRLF. A
 * `\x1b!o` escape sequence precedes every job to cancel a paused print state.
 *
 * The OpenTLP editor treats 0=black (ink) and 1=white (paper); TSPL BITMAP uses
 * 0=black (printed) and 1=white (blank), so the editor raster passes through
 * without inversion. Bits are packed MSB-first within each byte.
 * ========================================================================= */

const encoder = new TextEncoder();

function finite(value: number, name: string): number {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
    return value;
}

function mm(value: number, name: string): string {
    const rounded = Math.round(finite(value, name) * 100) / 100;
    if (rounded < 0) throw new RangeError(`${name} must not be negative.`);
    return String(rounded);
}

/** Cancel any paused print state: ESC ! o. */
export function cancelPause(): Uint8Array {
    return new Uint8Array([0x1b, 0x21, 0x6f]);
}

/** ASCII command terminated with CRLF. */
export function command(line: string): Uint8Array {
    return encoder.encode(`${line}\r\n`);
}

/** SIZE <width> mm,<height> mm. Width and height must be positive. */
export function size(widthMm: number, heightMm: number): Uint8Array {
    const width = mm(widthMm, 'Label width');
    const height = mm(heightMm, 'Label height');
    if (Number(width) <= 0) throw new RangeError('Label width must be positive.');
    if (Number(height) <= 0) throw new RangeError('Label height must be positive.');
    return command(`SIZE ${width} mm,${height} mm`);
}

/** GAP <gap> mm,<offset> mm. The gap must be positive; the offset may be zero. */
export function gap(gapMm: number, offsetMm = 0): Uint8Array {
    const gapValue = mm(gapMm, 'Gap');
    const offset = mm(offsetMm, 'Gap offset');
    if (Number(gapValue) <= 0) throw new RangeError('Gap must be positive.');
    return command(`GAP ${gapValue} mm,${offset} mm`);
}

/** DIRECTION <direction>,<mirror>. */
export function direction(direction: number, mirror: number): Uint8Array {
    const d = Math.round(finite(direction, 'Direction'));
    const m = Math.round(finite(mirror, 'Mirror'));
    if (d !== 0 && d !== 1) throw new RangeError('Direction must be 0 or 1.');
    if (m !== 0 && m !== 1) throw new RangeError('Mirror must be 0 or 1.');
    return command(`DIRECTION ${d},${m}`);
}

/** DENSITY <level>, clamped to 0..15. */
export function density(level: number): Uint8Array {
    const n = Math.max(0, Math.min(15, Math.round(finite(level, 'Density'))));
    return command(`DENSITY ${n}`);
}

/** CLS clears the image buffer. */
export function clear(): Uint8Array {
    return command('CLS');
}

/**
 * BITMAP header: `BITMAP x,y,widthBytes,height,mode,` with binary raster bytes
 * appended directly after the comma (no CRLF before the data). The caller writes
 * the raster payload and a trailing CRLF separately.
 */
export function bitmapHeader(x: number, y: number, widthBytes: number, height: number, mode = 1): Uint8Array {
    if (!Number.isInteger(widthBytes) || widthBytes < 1) {
        throw new RangeError('Bitmap width must be positive bytes.');
    }
    if (!Number.isInteger(height) || height < 1) {
        throw new RangeError('Bitmap height must be positive rows.');
    }
    if (!Number.isInteger(x) || x < 0) throw new RangeError('Bitmap x must be non-negative.');
    if (!Number.isInteger(y) || y < 0) throw new RangeError('Bitmap y must be non-negative.');
    if (mode !== 0 && mode !== 1) throw new RangeError('Bitmap mode must be 0 or 1.');
    return encoder.encode(`BITMAP ${x},${y},${widthBytes},${height},${mode},`);
}

/** CRLF terminator following binary raster bytes. */
export function rasterTerminator(): Uint8Array {
    return command('');
}

/** PRINT <copies>. */
export function print(copies: number): Uint8Array {
    const n = Math.max(1, Math.round(finite(copies, 'Copies')));
    return command(`PRINT ${n}`);
}
