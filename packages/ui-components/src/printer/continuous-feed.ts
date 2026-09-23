import type { PrinterCapabilities } from 'universal-label-core';

export type ContinuousFeedMode = 'balanced' | 'minimum' | 'custom';

/** Commanded feed and the resulting margins of a cut continuous label. */
export function resolveContinuousFeed(
    caps: PrinterCapabilities | undefined,
    mode: ContinuousFeedMode,
    customBeforeMm?: number,
    customAfterMm?: number
) {
    const defaults = caps?.mediaDefaults;
    const offset = caps?.physical?.headToCutterPx ?? 0;
    const dpmm = caps?.dpmm ?? 8;
    const hasBefore = defaults?.feedBeforeDefaultPx !== undefined;
    const hasAfter = defaults?.feedAfterDefaultPx !== undefined;
    const beforeMin = defaults?.feedBeforeMinPx ?? 0;
    const beforeMax = defaults?.feedBeforeMaxPx ?? Number.MAX_SAFE_INTEGER;
    const afterMax = defaults?.feedAfterMaxPx ?? Number.MAX_SAFE_INTEGER;
    const afterMin = Math.min(afterMax, Math.max(offset, defaults?.feedAfterMinPx ?? 0));
    const canBalance = offset > 0 && hasBefore && hasAfter
        && beforeMax >= beforeMin
        && afterMin <= 2 * offset + beforeMin
        && afterMax >= 2 * offset + beforeMin;
    const selected = canBalance ? mode : 'custom';

    const clamp = (dots: number, min: number, max: number) =>
        Math.min(max, Math.max(min, Math.round(dots)));

    const beforeDots = hasBefore ? clamp(
        selected === 'custom' && customBeforeMm !== undefined && Number.isFinite(customBeforeMm)
            ? customBeforeMm * dpmm : selected === 'custom' ? defaults.feedBeforeDefaultPx! : beforeMin,
        beforeMin, beforeMax
    ) : undefined;
    const afterDots = hasAfter ? clamp(
        selected === 'custom' && customAfterMm !== undefined && Number.isFinite(customAfterMm)
            ? customAfterMm * dpmm
            : selected === 'balanced' ? offset + offset + (beforeDots ?? 0)
            : selected === 'minimum' ? afterMin
            : defaults.feedAfterDefaultPx!,
        afterMin, afterMax
    ) : undefined;

    return {
        canBalance,
        beforeDots,
        afterDots,
        // Starting from a cut edge, the tape between cutter and printhead is
        // already blank. Trailing feed first moves the last dot to the cutter.
        leadingMarginDots: (beforeDots ?? 0) + offset,
        trailingMarginDots: Math.max(0, (afterDots ?? 0) - offset)
    };
}
