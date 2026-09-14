import { describe, expect, it } from 'vitest';
import { PrintManager } from 'universal-label-core';
import { AUTO_APP_PROFILES } from '../data/auto-profiles';
import { KNOWN_COMPANION_APPS } from '../data/app-directory';

describe('Printer Picker App & Conditional Kind Logic', () => {
    const pm = new PrintManager();

    it('collects all manufacturer replaced apps across registered drivers', () => {
        const apps = pm.getReplacedApps();
        expect(apps).toContain('Pocket Printer');
        expect(apps).toContain('Pocket Print');
        expect(apps).toContain('Tiny Print');
        expect(apps).toContain('Marklife');
        expect(apps).toContain('NIIMBOT');
        expect(apps).toContain('Phomemo');
        expect(apps).toContain('Print Master');
        expect(apps).toContain('Fun Print');
        expect(apps).toContain('WalkPrint');
        expect(apps).toContain('PeriPage');
    });

    it('requires device protocol disambiguation only for apps supporting multiple driver protocols', () => {
        // Pocket Printer app replaces two different driver protocols (Catprinter 58mm and Marklife L13)
        const pocketPrinterProtocols = pm.getKindsForApp('Pocket Printer');
        expect(pocketPrinterProtocols).toContain('pocket');
        expect(pocketPrinterProtocols).toContain('label');
        expect(pocketPrinterProtocols.length).toBeGreaterThanOrEqual(2);

        // Phomemo has both M02 continuous protocol and M110/D30 label protocol
        const phomemoProtocols = pm.getKindsForApp('Phomemo');
        expect(phomemoProtocols).toContain('pocket');
        expect(phomemoProtocols).toContain('label');
        expect(phomemoProtocols.length).toBeGreaterThanOrEqual(2);

        // Single protocol apps: no disambiguation needed
        expect(pm.getKindsForApp('Marklife')).toEqual(['label']);
        expect(pm.getKindsForApp('Tiny Print')).toEqual(['pocket']);
        expect(pm.getKindsForApp('NIIMBOT')).toEqual(['label']);
        expect(pm.getKindsForApp('Fun Print')).toEqual(['pocket']);
        expect(pm.getKindsForApp('PeriPage')).toEqual(['pocket']);
    });

    it('correctly associates AUTO_APP_PROFILES with replacesApps and protocols', () => {
        // Pocket Printer has auto profiles for both continuous and label protocols
        const pocketPrinterAutos = AUTO_APP_PROFILES.filter(
            a => a.app === 'Pocket Printer' || a.replacesApps?.includes('Pocket Printer')
        );
        expect(pocketPrinterAutos.some(a => a.kind === 'pocket')).toBe(true);
        expect(pocketPrinterAutos.some(a => a.kind === 'label')).toBe(true);

        // Tiny Print auto-detect profile
        const tinyAutos = AUTO_APP_PROFILES.filter(
            a => a.app === 'Tiny Print' || a.replacesApps?.includes('Tiny Print')
        );
        expect(tinyAutos.length).toBeGreaterThanOrEqual(1);
        expect(tinyAutos.every(a => a.kind === 'pocket')).toBe(true);

        // Marklife auto-detect profile
        const marklifeAutos = AUTO_APP_PROFILES.filter(
            a => a.app === 'Marklife' || a.replacesApps?.includes('Marklife')
        );
        expect(marklifeAutos.length).toBeGreaterThanOrEqual(1);
        expect(marklifeAutos.every(a => a.kind === 'label')).toBe(true);
    });

    it('inherits replacesApps and supportedKinds on flattened profiles from PrintManager', () => {
        const printerProfiles = pm.getAvailablePrinterProfiles();
        const p12 = printerProfiles.find(p => p.id === 'marklife_p12');
        expect(p12).toBeDefined();
        expect(p12?.app).toBe('Marklife');
        expect(p12?.kind).toBe('label');
        expect(p12?.replacesApps).toContain('Marklife');

        const m110 = printerProfiles.find(p => p.id === 'phomemo_m110');
        expect(m110).toBeDefined();
        expect(m110?.replacesApps).toContain('Phomemo');
        expect(m110?.replacesApps).toContain('Print Master');

        const gb01 = printerProfiles.find(p => p.id === 'catprinter_gb01');
        expect(gb01).toBeDefined();
        expect(gb01?.replacesApps).toContain('Pocket Printer');
        expect(gb01?.replacesApps).toContain('Pocket Print');
        expect(gb01?.replacesApps).toContain('Tiny Print');

        const l13 = printerProfiles.find(p => p.id === 'marklife_l13');
        expect(l13).toBeDefined();
        expect(l13?.replacesApps).toContain('Pocket Printer');
        expect(l13?.replacesApps).toContain('Pocket Print');
    });
});

describe('Companion App Directory (KNOWN_COMPANION_APPS)', () => {
    it('contains all major supported companion apps with required metadata', () => {
        const expectedApps = [
            'pocket_printer',
            'marklife',
            'tiny_print',
            'niimbot',
            'print_master',
            'phomemo',
            'fun_print',
            'walkprint',
            'peripage',
            'flashlabel',
            'labelife',
            'munbyn_print'
        ];

        for (const expectedId of expectedApps) {
            const found = KNOWN_COMPANION_APPS.find(a => a.id === expectedId);
            expect(found, `Expected companion app id: ${expectedId}`).toBeDefined();
            expect(found?.name.length).toBeGreaterThan(0);
            expect(found?.developer.length).toBeGreaterThan(0);
            expect(found?.brandColor).toMatch(/^#[0-9a-fA-F]{6}$/);
            expect(found?.badgeLetter.length).toBe(1);
            expect(found?.replacesApps.length).toBeGreaterThan(0);
            expect(found?.brandPalette).toBeDefined();
            expect(found?.brandPalette.length).toBeGreaterThanOrEqual(2);
            expect(found?.brandPalette.length).toBeLessThanOrEqual(4);
            expect(found?.brandPalette).toContain(found?.brandColor);
            for (const color of found?.brandPalette ?? []) {
                expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
            }
        }

        // Marklife has the salmon foreground shape on a white background and verified play store URL
        const marklifeApp = KNOWN_COMPANION_APPS.find(a => a.id === 'marklife');
        expect(marklifeApp?.brandPalette).toEqual(['#fb4e48', '#ffffff']);
        expect(marklifeApp?.playStoreUrl).toBe('https://play.google.com/store/apps/details?id=com.feioou.deliprint.yxq');

        // Munbyn and Labelife have white backgrounds with their brand color as foreground
        const munbynApp = KNOWN_COMPANION_APPS.find(a => a.id === 'munbyn_print');
        expect(munbynApp?.brandPalette).toEqual(['#ffffff', '#ff4713']);

        const labelifeApp = KNOWN_COMPANION_APPS.find(a => a.id === 'labelife');
        expect(labelifeApp?.brandPalette).toEqual(['#ffffff', '#3d81f8']);
    });

    it('accurately configures Pocket Printer for Karsten International hardware', () => {
        const pocketApp = KNOWN_COMPANION_APPS.find(a => a.id === 'pocket_printer');
        expect(pocketApp).toBeDefined();
        expect(pocketApp?.name).toBe('Pocket Printer');
        expect(pocketApp?.developer).toContain('Karsten International');
        expect(pocketApp?.popularModels).toEqual(expect.arrayContaining(['L13', 'SilverCrest', 'Crafts&Co']));
        expect(pocketApp?.isMultiDevice).toBe(true);
        expect(pocketApp?.replacesApps).toContain('Pocket Printer');
        expect(pocketApp?.replacesApps).toContain('Pocket Print');
    });

    it('identifies multi-device apps matching PrintManager multi-protocol capabilities', () => {
        const pm = new PrintManager();
        for (const app of KNOWN_COMPANION_APPS) {
            const kinds = pm.getKindsForApp(app.name);
            if (kinds.length > 1) {
                expect(app.isMultiDevice).toBe(true);
            }
        }
    });

    it('provides HTTPS store URLs pointing to official stores without remote tracking/CDN image embeds', () => {
        for (const app of KNOWN_COMPANION_APPS) {
            if (app.playStoreUrl) {
                expect(app.playStoreUrl).toMatch(/^https:\/\/play\.google\.com\/store\/apps\/details\?id=/);
            }
            if (app.appStoreUrl) {
                expect(app.appStoreUrl).toMatch(/^https:\/\/apps\.apple\.com\/app\//);
            }
        }
    });

    it('matches search terms against app names, developers, and popular models', () => {
        function searchApps(query: string) {
            const q = query.trim().toLowerCase();
            const tokens = q.split(/\s+/).filter(Boolean);
            return KNOWN_COMPANION_APPS.filter(app => {
                const haystack = [
                    app.name,
                    app.developer,
                    app.summary,
                    ...(app.replacesApps ?? []),
                    ...(app.popularModels ?? [])
                ].join(' ').toLowerCase();
                return tokens.every(t => haystack.includes(t));
            });
        }

        // Searching manufacturer / distributor
        const karstenMatches = searchApps('Karsten');
        expect(karstenMatches.map(m => m.id)).toContain('pocket_printer');

        // Searching retail rebrand
        const silvercrestMatches = searchApps('SilverCrest');
        expect(silvercrestMatches.map(m => m.id)).toContain('pocket_printer');

        // Searching specific model
        const l13Matches = searchApps('L13');
        expect(l13Matches.map(m => m.id)).toContain('pocket_printer');

        const m110Matches = searchApps('M110');
        expect(m110Matches.map(m => m.id)).toContain('phomemo');

        const catMatches = searchApps('cat');
        expect(catMatches.map(m => m.id)).toContain('tiny_print');
    });
});
