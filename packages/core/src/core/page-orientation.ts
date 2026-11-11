import type { UniversalPrintOptions } from '../drivers/driver.interface';
import type { UniversalPage } from '../types/ink';

/** Place a design on the roll; drivers still receive X = feed, Y = printhead. */
export function orientPageForFeed(page: UniversalPage, edge: UniversalPrintOptions['feedEdge']): UniversalPage {
    if (edge === undefined || edge === 'left') return page;
    if (edge !== 'top' && edge !== 'right' && edge !== 'bottom') {
        throw new RangeError('Unknown print feed edge.');
    }
    const sideways = edge !== 'right';
    const width = sideways ? page.height : page.width;
    const height = sideways ? page.width : page.height;
    const orient = (source: Uint8Array | Uint8ClampedArray): Uint8Array => {
        const data = new Uint8Array(width * height * 4);
        for (let y = 0; y < page.height; y++) {
            for (let x = 0; x < page.width; x++) {
                const dx = edge === 'top' ? y : edge === 'bottom' ? page.height - 1 - y : page.width - 1 - x;
                const dy = edge === 'top' ? page.width - 1 - x : edge === 'bottom' ? x : page.height - 1 - y;
                const offset = (y * page.width + x) * 4;
                data.set(source.subarray(offset, offset + 4), (dy * width + dx) * 4);
            }
        }
        return data;
    };
    return page.colorModel === 'rgb'
        ? { ...page, width, height, data: orient(page.data) }
        : { ...page, width, height, planes: page.planes.map(plane => ({
            ...plane, width, height, data: orient(plane.data)
        })) };
}
