import { describe, it, expect } from 'vitest';
import {
    collectCoarseEnvironment,
    collectWebCapabilities,
    buildReportMarkdown,
    buildGitHubIssueUrl,
    printEvidenceDimensions,
    samePrintEvidenceDimensions,
    type ReportKind,
    type HumanDetails,
    type AutomaticDiagnostics
} from './report';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CHROME_WINDOWS_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const EDGE_WINDOWS_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
const FIREFOX_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
const SAFARI_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15';
const ANDROID_CHROME_UA =
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const IPHONE_SAFARI_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';

function baseHuman(): HumanDetails {
    return {
        brand: 'Phomemo',
        model: 'P12',
        problemCategory: 'Connection failure',
        whatHappened: 'The printer does not appear in the device picker.',
        expectedResult: 'The printer should be listed and connect.'
    };
}

function baseAuto(): AutomaticDiagnostics {
    const env = collectCoarseEnvironment(CHROME_WINDOWS_UA);
    const caps = collectWebCapabilities();
    return {
        build: '0.1.0',
        runtime: 'web',
        browserFamily: env.browserFamily,
        browserMajor: env.browserMajor,
        osFamily: env.osFamily,
        secureContext: caps.secureContext,
        webBluetooth: caps.webBluetooth,
        webUsb: caps.webUsb,
        webSerial: caps.webSerial,
        connectionState: 'disconnected',
        profileId: 'marklife_p12',
        hardwareId: 'marklife-p12',
        profileBrand: 'Marklife',
        profileModel: 'P12',
        transportKind: 'web-bluetooth',
        transportType: 'Web Bluetooth',
        driverName: 'MarklifeProtocol',
        maxDensity: 15,
        canvasHeightPx: 96,
        supportsSpeedMode: false,
        colorType: 'monochrome',
        colorChannels: 1,
        dpmm: 8,
        errorCode: 'not-connected',
        pageWidthPx: 200,
        pageHeightPx: 96,
        pageWidthMm: 25,
        pageHeightMm: 12,
        mediaWidthMm: 12,
        paperType: 'continuous',
        printDensity: 5,
        printCopies: 1,
        printSpeed: 0,
        printResult: 'failed',
        diagnosticCandidates: [{ name: 'Marklife-0x1F', matchedBy: 'both' }]
    };
}

/**
 * Distinctive sentinel strings that must never appear in report output.
 * They simulate forbidden data that a caller might try to attach.
 */
const FORBIDDEN_SENTINELS = [
    'SENTINEL_RAW_UA',
    'SENTINEL_DEVICE_ID',
    'SENTINEL_MAC_ADDR',
    'SENTINEL_USB_VENDOR',
    'SENTINEL_USB_PRODUCT',
    'SENTINEL_RAW_ERROR',
    'SENTINEL_RASTER_DATA',
    'SENTINEL_DESIGN_CONTENT',
    'SENTINEL_PAPER_ID',
    'SENTINEL_PAPER_NAME',
    'SENTINEL_SCREEN',
    'SENTINEL_LANGUAGE',
    'SENTINEL_TIMEZONE',
    'SENTINEL_LOCATION',
    'SENTINEL_LOCAL_STORAGE',
    'SENTINEL_COOKIE'
] as const;

// ---------------------------------------------------------------------------
// collectCoarseEnvironment
// ---------------------------------------------------------------------------

describe('collectCoarseEnvironment', () => {
    it('parses Chrome on Windows', () => {
        const env = collectCoarseEnvironment(CHROME_WINDOWS_UA);
        expect(env.browserFamily).toBe('Chrome');
        expect(env.browserMajor).toBe('120');
        expect(env.osFamily).toBe('Windows');
    });

    it('parses Edge on Windows (Edge before Chrome)', () => {
        const env = collectCoarseEnvironment(EDGE_WINDOWS_UA);
        expect(env.browserFamily).toBe('Edge');
        expect(env.browserMajor).toBe('120');
        expect(env.osFamily).toBe('Windows');
    });

    it('parses Firefox', () => {
        const env = collectCoarseEnvironment(FIREFOX_UA);
        expect(env.browserFamily).toBe('Firefox');
        expect(env.browserMajor).toBe('121');
        expect(env.osFamily).toBe('Windows');
    });

    it('parses Safari on macOS', () => {
        const env = collectCoarseEnvironment(SAFARI_UA);
        expect(env.browserFamily).toBe('Safari');
        expect(env.browserMajor).toBe('17');
        expect(env.osFamily).toBe('macOS');
    });

    it('parses Chrome on Android', () => {
        const env = collectCoarseEnvironment(ANDROID_CHROME_UA);
        expect(env.browserFamily).toBe('Chrome');
        expect(env.browserMajor).toBe('120');
        expect(env.osFamily).toBe('Android');
    });

    it('parses Safari on iOS', () => {
        const env = collectCoarseEnvironment(IPHONE_SAFARI_UA);
        expect(env.browserFamily).toBe('Safari');
        expect(env.browserMajor).toBe('17');
        expect(env.osFamily).toBe('iOS');
    });

    it('returns unknown for empty UA', () => {
        const env = collectCoarseEnvironment('');
        expect(env.browserFamily).toBe('unknown');
        expect(env.browserMajor).toBe('0');
        expect(env.osFamily).toBe('unknown');
    });

    it('never returns the raw UA string', () => {
        const env = collectCoarseEnvironment(CHROME_WINDOWS_UA);
        const json = JSON.stringify(env);
        expect(json).not.toContain('Mozilla');
        expect(json).not.toContain('AppleWebKit');
        expect(json).not.toContain('KHTML');
    });
});

// ---------------------------------------------------------------------------
// collectWebCapabilities
// ---------------------------------------------------------------------------

describe('collectWebCapabilities', () => {
    it('returns four booleans', () => {
        const caps = collectWebCapabilities();
        expect(typeof caps.secureContext).toBe('boolean');
        expect(typeof caps.webBluetooth).toBe('boolean');
        expect(typeof caps.webUsb).toBe('boolean');
        expect(typeof caps.webSerial).toBe('boolean');
    });
});

// ---------------------------------------------------------------------------
// buildReportMarkdown — safe inclusion
// ---------------------------------------------------------------------------

describe('buildReportMarkdown — safe inclusion', () => {
    it('includes all user detail fields', () => {
        const md = buildReportMarkdown('print-problem', baseHuman(), baseAuto());
        expect(md).toContain('Phomemo');
        expect(md).toContain('P12');
        expect(md).toContain('Connection failure');
        expect(md).toContain('The printer does not appear in the device picker.');
        expect(md).toContain('The printer should be listed and connect.');
    });

    it('includes optional fields when provided', () => {
        const human = {
            ...baseHuman(),
            advertisedName: 'P12-A1B2',
            firmware: 'v1.2.3',
            hardware: 'rev-2',
            serviceUuids: ['0000ff00-0000-1000-8000-00805f9b34fb'],
            diagnosticLog: '#01 connection established',
            note: 'Happens every time.'
        };
        const md = buildReportMarkdown('print-problem', human, baseAuto());
        expect(md).toContain('P12-A1B2');
        expect(md).toContain('v1.2.3');
        expect(md).toContain('rev-2');
        expect(md).toContain('0000ff00-0000-1000-8000-00805f9b34fb');
        expect(md).toContain('#01 connection established');
        expect(md).toContain('Happens every time.');
    });

    it('omits optional fields when absent', () => {
        const md = buildReportMarkdown('print-problem', baseHuman(), baseAuto());
        expect(md).not.toContain('Advertised name');
        expect(md).not.toContain('Firmware');
        expect(md).not.toContain('Hardware');
        expect(md).not.toContain('Note');
    });

    it('includes automatic context fields', () => {
        const md = buildReportMarkdown('print-problem', baseHuman(), baseAuto());
        expect(md).toContain('0.1.0');
        expect(md).toContain('web');
        expect(md).toContain('Chrome 120');
        expect(md).toContain('Windows');
        expect(md).toContain('disconnected');
        expect(md).toContain('marklife_p12');
        expect(md).toContain('Marklife');
        expect(md).toContain('P12');
        expect(md).toContain('web-bluetooth');
        expect(md).toContain('Web Bluetooth');
        expect(md).toContain('MarklifeProtocol');
        expect(md).toContain('15');
        expect(md).toContain('96 px');
        expect(md).toContain('monochrome');
        expect(md).toContain('8 dpmm');
        expect(md).toContain('not-connected');
        expect(md).toContain('200x96 px');
        expect(md).toContain('25x12 mm');
        expect(md).toContain('continuous');
        expect(md).toContain('density 5');
        expect(md).toContain('1 copy');
        expect(md).toContain('speed 0');
        expect(md).toContain('result failed');
        expect(md).toContain('Marklife-0x1F (both)');
    });

    it('keeps in-app privacy guidance and maintainer boilerplate out of the shared issue', () => {
        const md = buildReportMarkdown('print-problem', baseHuman(), baseAuto());
        expect(md).not.toContain('### Privacy');
        expect(md).not.toContain('### Maintainer checklist');
        expect(md).not.toContain('Triage the model and protocol family');
    });

    it('labels the report kind correctly for each kind', () => {
        const kinds: ReportKind[] = ['missing-printer', 'print-success', 'print-problem'];
        for (const kind of kinds) {
            const md = buildReportMarkdown(kind, baseHuman(), baseAuto());
            expect(md).toContain('**Report type:**');
        }
        expect(buildReportMarkdown('missing-printer', baseHuman(), baseAuto())).toContain('Missing printer');
        expect(buildReportMarkdown('print-success', baseHuman(), baseAuto())).toContain('Successful print');
        expect(buildReportMarkdown('print-problem', baseHuman(), baseAuto())).toContain('Print problem');
    });
});

// ---------------------------------------------------------------------------
// buildReportMarkdown — bounding and control stripping
// ---------------------------------------------------------------------------

describe('buildReportMarkdown — bounding and control stripping', () => {
    it('strips C0 control characters from human fields', () => {
        const human: HumanDetails = {
            ...baseHuman(),
            brand: 'Pho\u0000me\u0001mo',
            whatHappened: 'It\u0007crashed\u000Bhere'
        };
        const md = buildReportMarkdown('print-problem', human, baseAuto());
        expect(md).not.toContain('\u0000');
        expect(md).not.toContain('\u0001');
        expect(md).not.toContain('\u0007');
        expect(md).not.toContain('\u000B');
        expect(md).toContain('Phomemo');
        expect(md).toContain('Itcrashedhere');
    });

    it('strips C1 control characters', () => {
        const human: HumanDetails = {
            ...baseHuman(),
            note: 'Has\u0080C1\u009Fchars'
        };
        const md = buildReportMarkdown('print-problem', human, baseAuto());
        expect(md).not.toContain('\u0080');
        expect(md).not.toContain('\u009F');
        expect(md).toContain('HasC1chars');
    });

    it('strips zero-width and BOM characters', () => {
        const human: HumanDetails = {
            ...baseHuman(),
            brand: 'Pho\u200Bmmo',
            note: 'Invis\uFEFFible'
        };
        const md = buildReportMarkdown('print-problem', human, baseAuto());
        expect(md).not.toContain('\u200B');
        expect(md).not.toContain('\uFEFF');
        expect(md).toContain('Phommo');
        expect(md).toContain('Invisible');
    });

    it('clamps long fields to the maximum length', () => {
        const long = 'A'.repeat(10_000);
        const human: HumanDetails = {
            ...baseHuman(),
            whatHappened: long,
            expectedResult: long,
            note: long
        };
        const md = buildReportMarkdown('print-problem', human, baseAuto());
        // The body must not contain the full 10k string.
        expect(md).not.toContain(long);
        // But it should contain the clamped prefix.
        expect(md).toContain('A'.repeat(1500));
        expect(md).not.toContain('A'.repeat(1501));
    });

    it('clamps short fields to a shorter maximum', () => {
        const long = 'B'.repeat(10_000);
        const human: HumanDetails = {
            ...baseHuman(),
            brand: long,
            model: long,
            problemCategory: long
        };
        const md = buildReportMarkdown('print-problem', human, baseAuto());
        expect(md).not.toContain(long);
        expect(md).toContain('B'.repeat(200));
        expect(md).not.toContain('B'.repeat(201));
    });

    it('trims leading and trailing whitespace', () => {
        const human: HumanDetails = {
            ...baseHuman(),
            brand: '  Phomemo  ',
            model: '\tP12\n'
        };
        const md = buildReportMarkdown('print-problem', human, baseAuto());
        expect(md).toContain('- **Brand:** Phomemo');
        expect(md).toContain('- **Model:** P12');
    });

    it('omits optional fields that become empty after sanitization', () => {
        const human: HumanDetails = {
            ...baseHuman(),
            advertisedName: '   \u0000\u0001   ',
            firmware: '\u200B\u200C',
            note: ''
        };
        const md = buildReportMarkdown('print-problem', human, baseAuto());
        expect(md).not.toContain('Advertised name');
        expect(md).not.toContain('Firmware');
        expect(md).not.toContain('Note');
    });
});

// ---------------------------------------------------------------------------
// Non-leakage of forbidden data
// ---------------------------------------------------------------------------

describe('buildReportMarkdown — non-leakage of forbidden sentinels', () => {
    const rawUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    it('ignores forbidden extra properties on AutomaticDiagnostics', () => {
        const auto = {
            ...baseAuto(),
            // Extra properties that must never appear in output.
            rawUserAgent: rawUA,
            deviceId: 'SENTINEL_DEVICE_ID',
            bluetoothAddress: 'SENTINEL_MAC_ADDR',
            usbVendorId: 'SENTINEL_USB_VENDOR',
            usbProductId: 'SENTINEL_USB_PRODUCT',
            rawError: 'SENTINEL_RAW_ERROR',
            errorStack: 'Error: SENTINEL_RAW_ERROR\n  at session.ts:110',
            rasterData: 'SENTINEL_RASTER_DATA',
            designContent: 'SENTINEL_DESIGN_CONTENT',
            paperId: 'SENTINEL_PAPER_ID',
            paperName: 'SENTINEL_PAPER_NAME',
            screenResolution: 'SENTINEL_SCREEN',
            language: 'SENTINEL_LANGUAGE',
            timezone: 'SENTINEL_TIMEZONE',
            location: 'SENTINEL_LOCATION',
            localStorageData: 'SENTINEL_LOCAL_STORAGE',
            cookieData: 'SENTINEL_COOKIE'
        } as AutomaticDiagnostics;

        const md = buildReportMarkdown('print-problem', baseHuman(), auto);

        for (const sentinel of FORBIDDEN_SENTINELS) {
            expect(md).not.toContain(sentinel);
        }
        expect(md).not.toContain('Mozilla');
        expect(md).not.toContain('AppleWebKit');
        expect(md).not.toContain('KHTML');
    });

    it('ignores forbidden extra properties on HumanDetails', () => {
        const human = {
            ...baseHuman(),
            rawUserAgent: rawUA,
            deviceId: 'SENTINEL_DEVICE_ID',
            bluetoothAddress: 'SENTINEL_MAC_ADDR',
            usbVendorId: 'SENTINEL_USB_VENDOR',
            rawError: 'SENTINEL_RAW_ERROR',
            rasterData: 'SENTINEL_RASTER_DATA',
            designContent: 'SENTINEL_DESIGN_CONTENT',
            paperId: 'SENTINEL_PAPER_ID',
            paperName: 'SENTINEL_PAPER_NAME',
            screenResolution: 'SENTINEL_SCREEN',
            language: 'SENTINEL_LANGUAGE',
            timezone: 'SENTINEL_TIMEZONE',
            location: 'SENTINEL_LOCATION',
            cookieData: 'SENTINEL_COOKIE'
        } as HumanDetails;

        const md = buildReportMarkdown('print-problem', human, baseAuto());

        for (const sentinel of FORBIDDEN_SENTINELS) {
            expect(md).not.toContain(sentinel);
        }
        expect(md).not.toContain('Mozilla');
    });

    it('ignores error-like extras with stack traces and messages', () => {
        const auto = {
            ...baseAuto(),
            error: new Error('SENTINEL_RAW_ERROR'),
            cause: { stack: 'Error: SENTINEL_RAW_ERROR\n  at session.ts:110:15' },
            rawErrorMessage: 'SENTINEL_RAW_ERROR'
        } as unknown as AutomaticDiagnostics;

        const md = buildReportMarkdown('print-problem', baseHuman(), auto);
        expect(md).not.toContain('SENTINEL_RAW_ERROR');
        expect(md).not.toContain('session.ts:110');
    });

    it('rejects malformed service identifiers from diagnostic context', () => {
        const human = {
            ...baseHuman(),
            serviceUuids: ['SENTINEL_DEVICE_ID', '<script>alert(1)</script>']
        } satisfies HumanDetails;
        const md = buildReportMarkdown('missing-printer', human, baseAuto());
        expect(md).not.toContain('SENTINEL_DEVICE_ID');
        expect(md).not.toContain('<script>');
    });
});

describe('successful-print evidence', () => {
    it('emits a versioned machine-readable marker only for successful reports', () => {
        const success = buildReportMarkdown('print-success', baseHuman(), { ...baseAuto(), printResult: 'sent' });
        expect(success).toContain('<!-- opentlp-print-evidence:v1 {');
        expect(success).toContain('"hardwareId":"marklife-p12"');
        expect(buildReportMarkdown('print-problem', baseHuman(), baseAuto())).not.toContain('opentlp-print-evidence');
    });

    it('does not emit evidence when a stable matrix dimension is missing', () => {
        const success = buildReportMarkdown('print-success', baseHuman(), {
            ...baseAuto(),
            printResult: 'sent',
            hardwareId: undefined
        });
        expect(success).not.toContain('opentlp-print-evidence');
        expect(printEvidenceDimensions({ ...baseAuto(), dpmm: Number.NaN })).toBeUndefined();
        expect(printEvidenceDimensions({ ...baseAuto(), mediaWidthMm: undefined })).toBeUndefined();
        expect(printEvidenceDimensions({ ...baseAuto(), paperType: undefined })).toBeUndefined();
    });

    it('compares every matrix dimension', () => {
        const dimensions = printEvidenceDimensions(baseAuto());
        expect(dimensions).toBeDefined();
        expect(samePrintEvidenceDimensions(dimensions!, { ...dimensions! })).toBe(true);
        for (const key of Object.keys(dimensions!) as (keyof typeof dimensions)[]) {
            const changed = { ...dimensions!, [key]: typeof dimensions![key] === 'number' ? 99 : `${dimensions![key]}-different` };
            expect(samePrintEvidenceDimensions(dimensions!, changed)).toBe(false);
        }
    });
});

// ---------------------------------------------------------------------------
// buildGitHubIssueUrl
// ---------------------------------------------------------------------------

describe('buildGitHubIssueUrl', () => {
    it('targets the OpenTLP issues/new endpoint', () => {
        const url = buildGitHubIssueUrl('print-problem', baseHuman(), baseAuto());
        expect(url.startsWith('https://github.com/opentlp/opentlp/issues/new?')).toBe(true);
    });

    it('encodes the title and body as query parameters', () => {
        const url = buildGitHubIssueUrl('print-problem', baseHuman(), baseAuto());
        expect(url).toContain('title=');
        expect(url).toContain('body=');
        // The raw markdown should not appear unencoded.
        expect(url).not.toContain('### User details');
        // But the decoded form should.
        expect(decodeURIComponent(url)).toContain('### User details');
    });

    it('uses the correct title per report kind', () => {
        expect(
            decodeURIComponent(buildGitHubIssueUrl('missing-printer', baseHuman(), baseAuto()))
        ).toContain('Missing printer support: Phomemo P12');

        expect(
            decodeURIComponent(buildGitHubIssueUrl('print-success', baseHuman(), baseAuto()))
        ).toContain('Successful print report: Phomemo P12');

        expect(
            decodeURIComponent(buildGitHubIssueUrl('print-problem', baseHuman(), baseAuto()))
        ).toContain('Print problem: Phomemo P12');
    });

    it('does not leak forbidden sentinels into the URL', () => {
        const auto = {
            ...baseAuto(),
            rawUserAgent: 'SENTINEL_RAW_UA',
            deviceId: 'SENTINEL_DEVICE_ID',
            bluetoothAddress: 'SENTINEL_MAC_ADDR',
            rawError: 'SENTINEL_RAW_ERROR',
            rasterData: 'SENTINEL_RASTER_DATA',
            paperId: 'SENTINEL_PAPER_ID',
            paperName: 'SENTINEL_PAPER_NAME',
            screenResolution: 'SENTINEL_SCREEN',
            language: 'SENTINEL_LANGUAGE',
            timezone: 'SENTINEL_TIMEZONE',
            location: 'SENTINEL_LOCATION',
            cookieData: 'SENTINEL_COOKIE'
        } as AutomaticDiagnostics;

        const url = buildGitHubIssueUrl('print-problem', baseHuman(), auto);
        const decoded = decodeURIComponent(url);

        for (const sentinel of FORBIDDEN_SENTINELS) {
            expect(decoded).not.toContain(sentinel);
        }
    });

    it('falls back to "Unknown printer" when brand and model are empty', () => {
        const human: HumanDetails = {
            ...baseHuman(),
            brand: '',
            model: ''
        };
        const url = buildGitHubIssueUrl('print-problem', human, baseAuto());
        expect(decodeURIComponent(url)).toContain('Unknown printer');
    });
});
