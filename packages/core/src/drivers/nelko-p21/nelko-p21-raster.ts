import type { UniversalImageData } from '../driver.interface';

const INK_THRESHOLD = 200;

/**
 * Encode the editor's horizontal RGBA canvas as the Nelko P21's MSB-first
 * TSPL BITMAP rows.
 *
 * COORDINATE SYSTEM: the editor canvas is height-fixed to the printhead
 * (96 dots) and width-variable (label length). The P21's BITMAP expects
 * `widthBytes` columns across the 96-dot head, one row per column of canvas
 * length, so each editor row (a fixed-height column of dots) becomes one TSPL
 * raster row.
 *
 * OpenTLP uses 0=black/ink and 1=white/paper; TSPL BITMAP uses 0=black
 * (printed) and 1=white (blank), so the packed bytes pass through without
 * inversion. Bits are MSB-first within each byte.
 *
 * The editor canvas is height-fixed to the printhead (96 dots), so each canvas
 * row maps directly to the corresponding printhead dot with no centering or
 * reversal, matching the device's top-aligned MSB-first BITMAP layout.
 */
export function encodeNelkoRaster(image: UniversalImageData, printheadDots: number): {
    data: Uint8Array;
    widthBytes: number;
    rows: number;
} {
    if (!Number.isInteger(printheadDots) || printheadDots < 1) {
        throw new RangeError('Printhead width must be a positive whole number.');
    }
    const widthBytes = Math.ceil(printheadDots / 8);
    const rows = image.width;
    if (!Number.isInteger(rows) || rows < 1) {
        throw new RangeError('Image width must be a positive whole number.');
    }
    const output = new Uint8Array(widthBytes * rows);

    for (let imageX = 0; imageX < image.width; imageX += 1) {
        for (let imageY = 0; imageY < image.height; imageY += 1) {
            const headDot = imageY;
            if (headDot < 0 || headDot >= printheadDots) continue;
            const source = (imageY * image.width + imageX) * 4;
            const alpha = image.data[source + 3] ?? 0;
            if (alpha === 0) continue;
            const luminance = ((image.data[source] ?? 255)
                + (image.data[source + 1] ?? 255)
                + (image.data[source + 2] ?? 255)) / 3;
            if (luminance > INK_THRESHOLD) continue;
            const byte = imageX * widthBytes + Math.floor(headDot / 8);
            output[byte] |= 0x80 >>> (headDot % 8);
        }
    }
    return { data: output, widthBytes, rows };
}
