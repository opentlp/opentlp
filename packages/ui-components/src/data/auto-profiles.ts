import type { PrinterModelProfile } from 'universal-label-core';

export const AUTO_APP_PROFILES: PrinterModelProfile[] = [
    {
        id: 'auto:tiny_print',
        brand: 'Tiny Print',
        model: 'Auto-detect Pocket Printer',
        app: 'Tiny Print',
        replacesApps: ['Tiny Print', 'iPrint'],
        kind: 'pocket',
        supportedTransports: ['bluetooth-le'],
        capabilities: { canvasHeightPx: 384, maxDensity: 1, supportsSpeedMode: false, colorSupport: { type: 'monochrome' }, dpmm: 8, driverName: 'Catprinter (Tiny 0x51/0x78)' },
        notes: 'Auto-connects to any Tiny Print-compatible pocket printer (GB01, MX05, MX06, etc.)'
    },
    {
        id: 'auto:pocket_print_pocket',
        brand: 'Pocket Printer',
        model: 'Auto-detect Pocket Printer',
        app: 'Pocket Printer',
        replacesApps: ['Pocket Printer', 'Pocket Print'],
        kind: 'pocket',
        supportedTransports: ['bluetooth-le'],
        capabilities: { canvasHeightPx: 384, maxDensity: 1, supportsSpeedMode: false, colorSupport: { type: 'monochrome' }, dpmm: 8, driverName: 'Catprinter (Tiny 0x51/0x78)' },
        notes: 'Connects using the Pocket Printer continuous protocol (Karsten / Crafts&Co / Action)'
    },
    {
        id: 'auto:pocket_print_label',
        brand: 'Pocket Printer',
        model: 'Auto-detect Label Printer',
        app: 'Pocket Printer',
        replacesApps: ['Pocket Printer', 'Pocket Print'],
        kind: 'label',
        supportedTransports: ['bluetooth-le', 'bluetooth-classic', 'usb-serial'],
        capabilities: { canvasHeightPx: 96, maxDensity: 15, supportsSpeedMode: false, colorSupport: { type: 'monochrome' }, dpmm: 8, driverName: 'Marklife-Legacy-L11' },
        notes: 'Connects using the Marklife legacy protocol (Karsten / L13 / DP-L13 / Silvercrest)'
    },
    {
        id: 'auto:marklife',
        brand: 'Marklife',
        model: 'Auto-detect Label Printer',
        app: 'Marklife',
        replacesApps: ['Marklife'],
        kind: 'label',
        supportedTransports: ['bluetooth-le', 'bluetooth-classic', 'usb-serial'],
        capabilities: { canvasHeightPx: 96, maxDensity: 15, supportsSpeedMode: false, colorSupport: { type: 'monochrome' }, dpmm: 8, driverName: 'Marklife-Protocol-0x1F' },
        notes: 'Auto-connects to any Marklife printer (P12, P11, P15, P50, etc.)'
    },
    {
        id: 'auto:niimbot',
        brand: 'NIIMBOT',
        model: 'Auto-detect Label Printer',
        app: 'NIIMBOT',
        replacesApps: ['NIIMBOT'],
        kind: 'label',
        supportedTransports: ['bluetooth-le', 'bluetooth-classic', 'usb-serial'],
        capabilities: { canvasHeightPx: 96, maxDensity: 3, supportsSpeedMode: false, colorSupport: { type: 'monochrome' }, dpmm: 8, driverName: 'Niimbot Generic Printer' },
        notes: 'Auto-connects to any NIIMBOT printer (D11, D110, B21, B1, etc.)'
    },
    {
        id: 'auto:walkprint',
        brand: 'WalkPrint',
        model: 'Auto-detect Pocket Printer',
        app: 'WalkPrint',
        replacesApps: ['WalkPrint'],
        kind: 'pocket',
        supportedTransports: ['bluetooth-le'],
        capabilities: { canvasHeightPx: 384, maxDensity: 1, supportsSpeedMode: false, colorSupport: { type: 'monochrome' }, dpmm: 8, driverName: 'Catprinter (V5X/MXW01 bulk raster)' },
        notes: 'Auto-connects to any WalkPrint-compatible pocket printer'
    },
    {
        id: 'auto:fun_print',
        brand: 'Fun Print',
        model: 'Auto-detect Pocket Printer',
        app: 'Fun Print',
        replacesApps: ['Fun Print', 'Funny Print', 'iPrint'],
        kind: 'pocket',
        supportedTransports: ['bluetooth-le'],
        capabilities: { canvasHeightPx: 384, maxDensity: 1, supportsSpeedMode: false, colorSupport: { type: 'monochrome' }, dpmm: 8, driverName: 'Funny Print (LX-D / BH-01 direct raster)' },
        notes: 'Auto-connects to any Fun Print-compatible pocket printer (BH-01, LX-D01, etc.)'
    },
    {
        id: 'auto:phomemo_pocket',
        brand: 'Phomemo',
        model: 'Auto-detect Pocket Printer',
        app: 'Phomemo',
        replacesApps: ['Phomemo'],
        kind: 'pocket',
        supportedTransports: ['bluetooth-le', 'bluetooth-classic', 'usb-serial', 'usb'],
        capabilities: { canvasHeightPx: 384, maxDensity: 8, supportsSpeedMode: false, colorSupport: { type: 'monochrome' }, dpmm: 8, driverName: 'Phomemo M02 family' },
        notes: 'Auto-connects to any Phomemo pocket printer (M02, M02S, etc.)'
    },
    {
        id: 'auto:phomemo_label',
        brand: 'Phomemo',
        model: 'Auto-detect Label Printer',
        app: 'Phomemo',
        replacesApps: ['Phomemo', 'Print Master'],
        kind: 'label',
        supportedTransports: ['bluetooth-le', 'bluetooth-classic', 'usb-serial', 'usb'],
        capabilities: { canvasHeightPx: 384, maxDensity: 8, supportsSpeedMode: false, colorSupport: { type: 'monochrome' }, dpmm: 8, driverName: 'Phomemo M110/M120/M220' },
        notes: 'Auto-connects to any Phomemo label printer (M110, M220, D30, etc.)'
    },
    {
        id: 'auto:print_master',
        brand: 'Print Master',
        model: 'Auto-detect Label Maker',
        app: 'Print Master',
        replacesApps: ['Print Master', 'Phomemo'],
        kind: 'label',
        supportedTransports: ['bluetooth-le', 'bluetooth-classic', 'usb-serial', 'usb'],
        capabilities: { canvasHeightPx: 384, maxDensity: 8, supportsSpeedMode: false, colorSupport: { type: 'monochrome' }, dpmm: 8, driverName: 'Phomemo M110/M120/M220' },
        notes: 'Auto-connects to any Print Master label printer (M110, M220, D30, etc.)'
    },
    {
        id: 'auto:peripage',
        brand: 'PeriPage',
        model: 'Auto-detect Pocket Printer',
        app: 'PeriPage',
        replacesApps: ['PeriPage'],
        kind: 'pocket',
        supportedTransports: ['bluetooth-le', 'bluetooth-classic', 'usb-serial', 'usb'],
        capabilities: { canvasHeightPx: 384, maxDensity: 1, supportsSpeedMode: false, colorSupport: { type: 'monochrome' }, dpmm: 8, driverName: 'PeriPage raw GS v 0' },
        notes: 'Auto-connects to any PeriPage pocket printer (A6, C6, etc.)'
    }
];
