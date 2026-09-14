import rawSnapshot from '@opentlp/hardware/catalogue';
import type { PrinterModelProfile } from 'universal-label-core';

export type CataloguePrinterProfile = Pick<
    PrinterModelProfile,
    'id' | 'tohId' | 'brand' | 'model' | 'family' | 'aliases' | 'app' | 'replacesApps' | 'kind' | 'supportedKinds' | 'supportedTransports'
>;

export interface OpenTlpDevice {
    id: string;
    brand: string;
    model: string;
    aliases?: readonly string[];
    rebadgeOf?: string | null;
    family?: string | null;
    app?: string | null;
    replacesApps?: readonly string[] | null;
    kind?: string | null;
    status?: 'verified' | 'reported' | 'unverified' | null;
}

export interface OpenTlpApp {
    id: string;
    name: string;
    developer: string;
    summary?: string | null;
    brandColor: string;
    brandPalette: readonly string[];
    badgeLetter: string;
    platforms: {
        android?: { package?: string; url?: string };
        ios?: { id?: string | number; url?: string };
    };
    protocols?: readonly string[];
    replacesApps?: readonly string[];
    popularModels?: readonly string[];
    isMultiDevice?: boolean;
    status?: 'verified' | 'reported' | 'unverified' | null;
}

export interface OpenTlpSnapshot {
    source: string;
    schemaVersion: number;
    generated: string;
    licence: string;
    count: number;
    devices: readonly OpenTlpDevice[];
    apps?: readonly OpenTlpApp[];
}

export const OPENTLP_CATALOGUE_URL = 'https://opentlp.github.io/table-of-hardware/';
export const OPENTLP_SNAPSHOT: OpenTlpSnapshot = rawSnapshot;
export const OPENTLP_DEVICES: readonly OpenTlpDevice[] = OPENTLP_SNAPSHOT.devices;
export const OPENTLP_APPS: readonly OpenTlpApp[] = OPENTLP_SNAPSHOT.apps ?? [];

const devicesById = new Map<string, OpenTlpDevice>();
for (const dev of OPENTLP_DEVICES) {
    if (dev?.id) {
        devicesById.set(dev.id, dev);
    }
}

/**
 * Infers protocol slug for Cat Printer profiles based on ID prefix.
 * - catprinter_v5g_ => catprinter-v5g
 * - catprinter_v5x_ => catprinter-v5x
 * - catprinter_v5c_ => catprinter-v5c
 * - catprinter_funny_lx_d => funny-lx
 * - remaining catprinter_ => tiny
 */
export function inferCatPrinterProtocolSlug(id: string): string | null {
    if (!id.startsWith('catprinter_')) {
        return null;
    }
    if (id.startsWith('catprinter_v5g_')) {
        return 'catprinter-v5g';
    }
    if (id.startsWith('catprinter_v5x_')) {
        return 'catprinter-v5x';
    }
    if (id.startsWith('catprinter_v5c_')) {
        return 'catprinter-v5c';
    }
    if (id.startsWith('catprinter_funny_lx_d')) {
        return 'funny-lx';
    }
    return 'tiny';
}

function normalizeModel(str: string | undefined | null): string {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Matches a PrinterModelProfile against the pinned OpenTLP catalogue snapshot.
 * 1. Matches exact profile id against OpenTLP device id.
 * 2. For Cat Printer IDs only, falls back by normalized model plus inferred protocol slug.
 * Returns a fallback only when exactly one snapshot record matches.
 */
export function matchOpenTlpDevice(profile: CataloguePrinterProfile): OpenTlpDevice | undefined {
    // 1. Match exact id first
    const exact = devicesById.get(profile.tohId ?? profile.id);
    if (exact) {
        return exact;
    }
    if (profile.tohId) {
        return undefined;
    }

    // 2. For Cat Printer IDs only, fall back by normalized model + protocol slug
    const protocolSlug = inferCatPrinterProtocolSlug(profile.id);
    if (!protocolSlug) {
        return undefined;
    }

    const normModel = normalizeModel(profile.model);
    if (!normModel) {
        return undefined;
    }

    const matches = OPENTLP_DEVICES.filter((dev) => {
        const family = dev.family ? dev.family.toLowerCase().trim() : '';
        if (family !== protocolSlug) {
            return false;
        }
        if (normalizeModel(dev.model) === normModel) {
            return true;
        }
        if (dev.aliases && dev.aliases.some((alias) => normalizeModel(alias) === normModel)) {
            return true;
        }
        return false;
    });

    if (matches.length === 1) {
        return matches[0];
    }

    return undefined;
}

/**
 * Combines profile brand/model/family/aliases with matched OpenTLP brand/model/family/aliases.
 */
export function getOpenTlpSearchTerms(profile: CataloguePrinterProfile, matched?: OpenTlpDevice | null): string[] {
    const dev = matched !== undefined ? matched : matchOpenTlpDevice(profile);
    const terms = new Set<string>();

    const add = (v: string | undefined | null) => {
        if (!v) return;
        const trimmed = v.trim();
        if (trimmed) {
            terms.add(trimmed);
        }
    };

    // Profile fields: brand, model, family, aliases, app, kind
    add(profile.brand);
    add(profile.model);
    add(profile.family);
    add(profile.app);
    if (profile.replacesApps) {
        for (const app of profile.replacesApps) add(app);
    }
    if (profile.kind) {
        add(profile.kind);
        if (profile.kind === 'pocket') add('pocket printer');
        if (profile.kind === 'label') add('label maker');
        if (profile.kind === 'label') add('label printer');
    }
    if (profile.aliases) {
        for (const alias of profile.aliases) {
            add(alias);
        }
    }

    // Matched OpenTLP fields: brand, model, family, aliases, app, replacesApps, kind
    if (dev) {
        add(dev.brand);
        add(dev.model);
        add(dev.family);
        add(dev.app);
        if (dev.replacesApps) {
            for (const app of dev.replacesApps) add(app);
        }
        if (dev.kind) {
            add(dev.kind);
            if (dev.kind === 'pocket') add('pocket printer');
            if (dev.kind === 'label') add('label maker');
            if (dev.kind === 'label') add('label printer');
        }
        if (dev.aliases) {
            for (const alias of dev.aliases) {
                add(alias);
            }
        }
    }

    return Array.from(terms);
}
