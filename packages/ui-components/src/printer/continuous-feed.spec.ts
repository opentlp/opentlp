import { describe, expect, it } from 'vitest';
import type { PrinterCapabilities } from 'universal-label-core';
import { resolveContinuousFeed } from './continuous-feed';

const p12 = {
    dpmm: 8,
    physical: { headToCutterPx: 66 },
    mediaDefaults: {
        feedBeforeMinPx: 0, feedBeforeMaxPx: 255, feedBeforeDefaultPx: 0,
        feedAfterMinPx: 66, feedAfterMaxPx: 255, feedAfterDefaultPx: 132
    }
} as PrinterCapabilities;

describe('continuous cut geometry', () => {
    it('balances the margins after accounting for the blank tape before the head', () => {
        expect(resolveContinuousFeed(p12, 'balanced')).toMatchObject({
            canBalance: true, beforeDots: 0, afterDots: 132,
            leadingMarginDots: 66, trailingMarginDots: 66
        });
        expect(resolveContinuousFeed(p12, 'minimum')).toMatchObject({
            beforeDots: 0, afterDots: 66,
            leadingMarginDots: 66, trailingMarginDots: 0
        });
    });

    it('clamps custom feed to the advertised physical and command limits', () => {
        expect(resolveContinuousFeed(p12, 'custom', 2, 1)).toMatchObject({
            beforeDots: 16, afterDots: 66,
            leadingMarginDots: 82, trailingMarginDots: 0
        });
        expect(resolveContinuousFeed(p12, 'custom', 100, 100).afterDots).toBe(255);
    });

    it('preserves an after-only printer without inventing cut geometry', () => {
        const afterOnly = {
            dpmm: 8,
            mediaDefaults: { feedAfterMinPx: 0, feedAfterMaxPx: 100, feedAfterDefaultPx: 25 }
        } as PrinterCapabilities;
        expect(resolveContinuousFeed(afterOnly, 'balanced', 9, 2)).toMatchObject({
            canBalance: false, beforeDots: undefined, afterDots: 16,
            leadingMarginDots: 0, trailingMarginDots: 16
        });
    });

    it('does not offer equal margins when the printer cannot feed far enough', () => {
        const limited = {
            ...p12,
            mediaDefaults: { ...p12.mediaDefaults, feedAfterMaxPx: 100, feedAfterDefaultPx: 100 }
        } as PrinterCapabilities;
        expect(resolveContinuousFeed(limited, 'balanced')).toMatchObject({
            canBalance: false, beforeDots: 0, afterDots: 100
        });
    });
});
