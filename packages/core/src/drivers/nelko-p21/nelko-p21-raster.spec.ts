import { describe, expect, it } from 'vitest';
import { encodeNelkoRaster } from './nelko-p21-raster';

describe('Nelko P21 raster', () => {
    it('packs a single black pixel into the MSB of the first byte', () => {
        const data = new Uint8Array(1 * 1 * 4);
        data[3] = 255;
        data[0] = data[1] = data[2] = 0;
        const raster = encodeNelkoRaster({ width: 1, height: 1, data }, 96);
        expect(raster.widthBytes).toBe(12);
        expect(raster.rows).toBe(1);
        expect(raster.data).toHaveLength(12);
        expect(raster.data[0]).toBe(0x80);
        expect(raster.data.slice(1)).toEqual(new Uint8Array(11));
    });

    it('packs the topmost canvas pixel at the head-start dot, not centered', () => {
        const data = new Uint8Array(1 * 8 * 4).fill(255);
        data[3] = 255;
        data[0] = data[1] = data[2] = 0;
        const raster = encodeNelkoRaster({ width: 1, height: 8, data }, 96);
        expect(raster.data[0]).toBe(0x80);
    });

    it('treats transparent (alpha 0) pixels as blank', () => {
        const data = new Uint8Array(1 * 1 * 4);
        data[0] = data[1] = data[2] = 0;
        data[3] = 0;
        const raster = encodeNelkoRaster({ width: 1, height: 1, data }, 96);
        expect(raster.data[0]).toBe(0x00);
    });

    it('treats light pixels (above the ink threshold) as blank', () => {
        const data = new Uint8Array(1 * 1 * 4).fill(255);
        data[3] = 255;
        const raster = encodeNelkoRaster({ width: 1, height: 1, data }, 96);
        expect(raster.data[0]).toBe(0x00);
    });

    it('throws for a non-positive printhead width', () => {
        expect(() => encodeNelkoRaster({ width: 1, height: 1, data: new Uint8Array(4) }, 0)).toThrow();
    });
});
