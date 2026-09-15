import { describe, expect, it } from 'vitest';
import {
    bitmapHeader,
    cancelPause,
    clear,
    density,
    direction,
    gap,
    isNelkoP21Compatible,
    NELKO_P21_GEOMETRY,
    print,
    rasterTerminator,
    size,
} from './nelko-p21-protocol';

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('Nelko P21 protocol subset', () => {
    it('builds documented media and print directives with CRLF', () => {
        expect(text(size(12, 40))).toBe('SIZE 12 mm,40 mm\r\n');
        expect(text(gap(2))).toBe('GAP 2 mm,0 mm\r\n');
        expect(text(direction(1, 1))).toBe('DIRECTION 1,1\r\n');
        expect(text(clear())).toBe('CLS\r\n');
        expect(text(print(1))).toBe('PRINT 1\r\n');
        expect(text(rasterTerminator())).toBe('\r\n');
    });

    it('clamps density to 0..15', () => {
        expect(text(density(8))).toBe('DENSITY 8\r\n');
        expect(text(density(20))).toBe('DENSITY 15\r\n');
        expect(text(density(-5))).toBe('DENSITY 0\r\n');
    });

    it('places binary data directly after the BITMAP comma with mode 1', () => {
        expect(text(bitmapHeader(0, 0, 12, 284))).toBe('BITMAP 0,0,12,284,1,');
        expect(text(bitmapHeader(0, 0, 12, 284, 0))).toBe('BITMAP 0,0,12,284,0,');
    });

    it('encodes the cancel-pause escape sequence ESC ! o', () => {
        expect([...cancelPause()]).toEqual([0x1b, 0x21, 0x6f]);
    });

    it('exposes the 96-dot 8-dpmm 203-dpi geometry with density 0..15', () => {
        expect(NELKO_P21_GEOMETRY).toEqual({ headDots: 96, dpmm: 8, dpi: 203, maxDensity: 15 });
    });

    it('matches Nelko and P21 name tokens and rejects unrelated names', () => {
        expect(isNelkoP21Compatible('Nelko P21')).toBe(true);
        expect(isNelkoP21Compatible('Nelko-P21')).toBe(true);
        expect(isNelkoP21Compatible('Nelko_P21')).toBe(true);
        expect(isNelkoP21Compatible('P21')).toBe(true);
        expect(isNelkoP21Compatible('PeriPage A6')).toBe(false);
        expect(isNelkoP21Compatible('')).toBe(false);
    });

    it('rejects negative or zero media dimensions', () => {
        expect(() => size(0, 40)).toThrow();
        expect(() => size(12, -1)).toThrow();
        expect(() => gap(-1)).toThrow();
    });
});
