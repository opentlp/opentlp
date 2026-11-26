import { describe, expect, it } from 'vitest';
import { encodeRaster, frame, rasterSlices, specialFeedPayload } from './astra-p1-protocol';

describe('YK Astra P1 protocol', () => {
    it('frames commands with a modulo-64 sequence and zero integrity field', () => {
        expect([...frame(0x0a, Uint8Array.of(0x19), 64)]).toEqual([
            0x64, 0x0a, 0x00, 0x01, 0x00, 0x19, 0x00, 0x00, 0x00, 0x00, 0x9b
        ]);
        expect([...specialFeedPayload(2, 800)]).toEqual([0x02, 0x20, 0x03]);
    });

    it('packs four 96-dot rows into the captured 48-byte raster slice', () => {
        const rgba = new Uint8Array(4 * 90 * 4).fill(255);
        rgba[3] = 255;
        rgba[0] = rgba[1] = rgba[2] = 0;
        const slices = rasterSlices(encodeRaster({ width: 4, height: 90, data: rgba }));
        expect(slices).toHaveLength(1);
        expect(slices[0]).toHaveLength(48);
        expect(slices[0][11]).toBe(0x01);
        expect(slices[0].slice(0, 11)).toEqual(new Uint8Array(11));
        expect(slices[0].slice(12)).toEqual(new Uint8Array(36));
    });

    it('places the first editor pixel at the far end of the 96-dot head (0x01), preserving the six-dot margin', () => {
        const rgba = new Uint8Array(1 * 1 * 4).fill(255);
        rgba[3] = 255;
        rgba[0] = rgba[1] = rgba[2] = 0;
        const raster = encodeRaster({ width: 1, height: 1, data: rgba });
        expect(raster).toHaveLength(12);
        expect(raster[11]).toBe(0x01);
        expect(raster.slice(0, 11)).toEqual(new Uint8Array(11));
    });

    it('reverses the editor cross-head axis for the physical S001 print direction', () => {
        const rgba = new Uint8Array(1 * 2 * 4);
        for (let i = 0; i < rgba.length; i += 4) {
            rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
            rgba[i + 3] = 255;
        }
        const raster = encodeRaster({ width: 1, height: 2, data: rgba });
        expect(raster.slice(0, 11)).toEqual(new Uint8Array(11));
        expect(raster[11]).toBe(0x03);
    });
});
