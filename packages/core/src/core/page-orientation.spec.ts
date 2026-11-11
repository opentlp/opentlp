import { describe, expect, it } from 'vitest';
import { orientPageForFeed } from './page-orientation';
import { monoPage, type UniversalPage } from '../types/ink';

const data = new Uint8Array([1, 2, 3, 4, 5, 6].flatMap(value => [value, 0, 0, 255]));
const image = { width: 3, height: 2, data };

describe('print feed edge', () => {
    it.each([
        ['top', 2, 3, [3, 6, 2, 5, 1, 4]],
        ['right', 3, 2, [6, 5, 4, 3, 2, 1]],
        ['bottom', 2, 3, [4, 1, 5, 2, 6, 3]]
    ] as const)('prints the %s edge first without mirroring or modifying the source', (edge, width, height, pixels) => {
        const original = new Uint8Array(data);
        const result = orientPageForFeed(monoPage(image), edge);
        expect([result.width, result.height]).toEqual([width, height]);
        if (result.colorModel !== 'spot') throw new Error('Expected spot page');
        expect([result.planes[0].width, result.planes[0].height]).toEqual([width, height]);
        expect([...result.planes[0].data].filter((_, i) => i % 4 === 0)).toEqual(pixels);
        expect(data).toEqual(original);
    });

    it('preserves every spot plane and ink id', () => {
        const page = monoPage(image);
        if (page.colorModel !== 'spot') throw new Error('Expected spot page');
        page.planes.push({ ...image, ink: 'red', data: new Uint8ClampedArray(data) });
        const result = orientPageForFeed(page, 'top');
        if (result.colorModel !== 'spot') throw new Error('Expected spot page');
        expect(result.planes.map(plane => plane.ink)).toEqual(['black', 'red']);
        expect(result.planes[1].data).toEqual(result.planes[0].data);
    });

    it('orients RGB pages with the same geometry', () => {
        const page: UniversalPage = { colorModel: 'rgb', ...image };
        const result = orientPageForFeed(page, 'top');
        expect(result).toMatchObject({ width: 2, height: 3, colorModel: 'rgb' });
        if (result.colorModel !== 'rgb') throw new Error('Expected RGB page');
        expect([...result.data].filter((_, i) => i % 4 === 0)).toEqual([3, 6, 2, 5, 1, 4]);
    });

    it('keeps existing jobs unchanged when no edge is selected', () => {
        const page = monoPage(image);
        expect(orientPageForFeed(page, undefined)).toBe(page);
        expect(orientPageForFeed(page, 'left')).toBe(page);
    });
});
