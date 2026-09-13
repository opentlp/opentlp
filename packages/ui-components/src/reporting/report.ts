/**
 * Privacy-safe GitHub issue report builder for OpenTLP Studio.
 *
 * Produces a pre-filled GitHub issue from coarse environment data and an
 * allowlisted set of printer diagnostics. The allowlist is enforced by the
 * {@link AutomaticDiagnostics} type itself: buildReportMarkdown and
 * buildGitHubIssueUrl destructure only the named fields, so any extra
 * properties a caller might attach are silently ignored at runtime.
 *
 * What is never collected, stored, or emitted:
 *   localStorage, cookies, device IDs, Bluetooth addresses, USB vendor/
 *   product IDs, raw error text, raster/image data, design/template content,
 *   paper id, paper name, the full user-agent string, screen resolution,
 *   language, timezone, or location.
 */
// Dependency-free: types mirror the relevant core enums locally so this
// module can be consumed without pulling in universal-label-core.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportKind = 'missing-printer' | 'print-success' | 'print-problem';

/** Mirrors core's PrinterErrorCode without importing it. */
export type PrinterErrorCode =
    | 'not-connected'
    | 'transport'
    | 'timeout'
    | 'protocol'
    | 'device-fault'
    | 'unsupported'
    | 'permission'
    | 'cancelled'
    | 'unknown';

/** Mirrors core's PaperProfile["type"] without importing it. */
export type PaperType =
    | 'gap'
    | 'continuous'
    | 'transparent'
    | 'black'
    | 'perforated'
    | 'pvc'
    | 'black-mark'
    | 'heat-shrink';

export type PrintResult = 'sent' | 'failed';

export interface PrintEvidenceDimensions {
    hardwareId: string;
    profileId: string;
    driverName: string;
    transportKind: string;
    transportType: string;
    runtime: string;
    osFamily: string;
    paperType: PaperType;
    dpmm: number;
    mediaWidthMm: number;
}

export interface PrintEvidenceCombination {
    dimensions: PrintEvidenceDimensions;
    confirmations: number;
}

export interface PrintEvidenceIndex {
    schemaVersion: 1;
    generatedAt: string | null;
    threshold: number;
    combinations: PrintEvidenceCombination[];
}

export type PrintEvidenceSource = Pick<AutomaticDiagnostics,
    'hardwareId' | 'profileId' | 'driverName' | 'transportKind' |
    'transportType' | 'runtime' | 'osFamily' | 'paperType' | 'dpmm' |
    'mediaWidthMm'>;

/** Safe facts about the most recent print attempt, supplied by PrintPanel. */
export interface PrintReportContext {
    pageWidthPx: number;
    pageHeightPx: number;
    pageWidthMm: number;
    pageHeightMm: number;
    /** Physical width of the selected paper/tape, independent of design size. */
    mediaWidthMm: number;
    paperType?: PaperType;
    printDensity: number;
    printCopies: number;
    printSpeed?: number;
    /** "sent" means Studio transmitted the job; it does not claim the physical output was correct. */
    printResult: PrintResult;
}

/** Structured, non-identifying facts from Core's unknown-printer probe. */
export interface DiagnosticReportContext {
    /** Device/advertised name exposed by the transport or driver. */
    advertisedName?: string;
    firmwareVersion?: string;
    hardwareVersion?: string;
    /** Static UI transport option id, e.g. web-bluetooth. */
    transportKind?: string;
    /** Concrete transport implementation name, e.g. Web Bluetooth. */
    transportType?: string;
    /** Driver selected or attempted for the operation. */
    driverName?: string;
    /** Trigger-specific description shown in the editable form. */
    whatHappened?: string;
    serviceUuids: readonly string[];
    candidateDrivers: readonly {
        name: string;
        matchedBy: 'name' | 'service' | 'both' | 'prefix-hint';
    }[];
}

/** Coarse browser and OS family derived from navigator.userAgent only. */
export interface CoarseEnvironment {
    browserFamily: string;
    browserMajor: string;
    osFamily: string;
}

/** Booleans for secure context and Web device APIs. */
export interface WebCapabilities {
    secureContext: boolean;
    webBluetooth: boolean;
    webUsb: boolean;
    webSerial: boolean;
}

/**
 * The complete allowlist of automatic diagnostics that may appear in a
 * report. Every field is either a coarse category, a safe number/boolean
 * from printer capabilities, or a typed enum. No free-form device data is
 * accepted.
 */
export interface AutomaticDiagnostics {
    /** App build identifier, e.g. "0.1.0". */
    build: string;
    /** Coarse runtime label, e.g. "web", "desktop", "capacitor". */
    runtime: string;
    browserFamily: string;
    browserMajor: string;
    osFamily: string;
    secureContext: boolean;
    webBluetooth: boolean;
    webUsb: boolean;
    webSerial: boolean;
    /** Printer session state. */
    connectionState: 'disconnected' | 'connecting' | 'connected' | 'printing';
    /** Static printer profile id (catalogue key, not a device id). */
    profileId?: string;
    /** Stable OpenTLP Table of Hardware id. */
    hardwareId?: string;
    profileBrand?: string;
    profileModel?: string;
    /** Transport family: "Web Bluetooth" | "Web USB" | "Web Serial" | "Dummy" ... */
    transportKind?: string;
    /** Concrete transport implementation reported by IDeviceTransport.type. */
    transportType?: string;
    /** Driver class name, e.g. "MarklifeProtocol". */
    driverName?: string;
    maxDensity?: number;
    canvasHeightPx?: number;
    supportsSpeedMode?: boolean;
    colorType?: string;
    colorChannels?: number;
    dpmm?: number;
    errorCode?: PrinterErrorCode;
    pageWidthPx?: number;
    pageHeightPx?: number;
    pageWidthMm?: number;
    pageHeightMm?: number;
    /** Physical paper/tape width used by the ToH evidence matrix. */
    mediaWidthMm?: number;
    paperType?: PaperType;
    printDensity?: number;
    printCopies?: number;
    printSpeed?: number;
    printResult?: PrintResult;
    diagnosticCandidates?: DiagnosticReportContext['candidateDrivers'];
}

/**
 * User-supplied free-form details. Every string field is sanitized: control
 * characters are stripped and length is clamped before inclusion in any
 * output.
 */
export interface HumanDetails {
    brand?: string;
    model?: string;
    /** Optional advertised Bluetooth device name. */
    advertisedName?: string;
    /** Optional firmware version string. */
    firmware?: string;
    /** Optional hardware revision string. */
    hardware?: string;
    /** User-reviewable protocol service UUIDs, initially filled by Studio. */
    serviceUuids?: readonly string[];
    /** Bounded OpenTLP diagnostic activity. Never a global console dump. */
    diagnosticLog?: string;
    problemCategory?: string;
    whatHappened?: string;
    expectedResult?: string;
    note?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ISSUE_URL = 'https://github.com/opentlp/opentlp/issues/new';
const MAX_SHORT = 200;
const MAX_LONG = 1500;
const MAX_LOG = 8000;
export const DEFAULT_PRINT_EVIDENCE_THRESHOLD = 3;
// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

function stripUnsafe(s: string): string {
    return Array.from(s, character => {
        const code = character.codePointAt(0) ?? 0;
        const isControl = code <= 0x1f || (code >= 0x7f && code <= 0x9f);
        const isInvisible = (code >= 0x200b && code <= 0x200f)
            || (code >= 0x202a && code <= 0x202e)
            || code === 0x2060
            || code === 0xfeff;
        return isControl || isInvisible ? '' : character;
    }).join('');
}

function sanitize(value: string | undefined, max: number): string {
    if (value === undefined) return '';
    return stripUnsafe(value).trim().slice(0, max);
}

function sanitizeOptional(value: string | undefined, max: number): string | undefined {
    if (value === undefined) return undefined;
    const cleaned = sanitize(value, max);
    return cleaned || undefined;
}

function safeServiceUuids(values: readonly string[] | undefined): string[] {
    return (values ?? [])
        .map(value => value.trim().toLowerCase())
        .filter(value => /^[a-f0-9-]{4,64}$/.test(value))
        .slice(0, 32);
}

/** Stable dimensions used by the ToH success-evidence matrix. */
export function printEvidenceDimensions(auto: PrintEvidenceSource): PrintEvidenceDimensions | undefined {
    const hardwareId = sanitizeOptional(auto.hardwareId, MAX_SHORT);
    const profileId = sanitizeOptional(auto.profileId, MAX_SHORT);
    const driverName = sanitizeOptional(auto.driverName, MAX_SHORT);
    const transportKind = sanitizeOptional(auto.transportKind, MAX_SHORT);
    const transportType = sanitizeOptional(auto.transportType, MAX_SHORT);
    const runtime = sanitizeOptional(auto.runtime, MAX_SHORT);
    const osFamily = sanitizeOptional(auto.osFamily, MAX_SHORT);
    if (!hardwareId || !profileId || !driverName || !transportKind || !transportType || !runtime || !osFamily) return undefined;
    if (!auto.paperType || !Number.isFinite(auto.dpmm) || !Number.isFinite(auto.mediaWidthMm)) return undefined;
    return {
        hardwareId,
        profileId,
        driverName,
        transportKind,
        transportType,
        runtime,
        osFamily,
        paperType: auto.paperType,
        dpmm: Number(auto.dpmm),
        mediaWidthMm: Number(Number(auto.mediaWidthMm).toFixed(2))
    };
}

export function samePrintEvidenceDimensions(a: PrintEvidenceDimensions, b: PrintEvidenceDimensions): boolean {
    return Object.keys(a).every(key => a[key as keyof PrintEvidenceDimensions] === b[key as keyof PrintEvidenceDimensions]);
}

// ---------------------------------------------------------------------------
// User-agent parsing (coarse, never returns the raw UA)
// ---------------------------------------------------------------------------

interface BrowserCheck {
    test: RegExp;
    family: string;
    version: RegExp;
    /** Skip this check when this pattern is present (e.g. Chrome masquerades as Safari). */
    exclude?: RegExp;
}

const BROWSER_CHECKS: readonly BrowserCheck[] = [
    { test: /Edg\//, family: 'Edge', version: /Edg\/(\d+)/ },
    { test: /OPR\/|Opera\//, family: 'Opera', version: /(?:OPR|Opera)\/(\d+)/ },
    { test: /SamsungBrowser\//, family: 'Samsung', version: /SamsungBrowser\/(\d+)/ },
    { test: /CriOS\//, family: 'Chrome', version: /CriOS\/(\d+)/ },
    { test: /FxiOS\//, family: 'Firefox', version: /FxiOS\/(\d+)/ },
    { test: /Firefox\//, family: 'Firefox', version: /Firefox\/(\d+)/ },
    { test: /Chrome\//, family: 'Chrome', version: /Chrome\/(\d+)/ },
    {
        test: /Safari\//,
        family: 'Safari',
        version: /Version\/(\d+)/,
        exclude: /Chrome\//
    }
];

function parseBrowser(ua: string): { family: string; major: string } {
    for (const check of BROWSER_CHECKS) {
        if (check.exclude && check.exclude.test(ua)) continue;
        if (check.test.test(ua)) {
            const m = ua.match(check.version);
            return { family: check.family, major: m ? m[1] : '0' };
        }
    }
    return { family: 'unknown', major: '0' };
}

function parseOsFamily(ua: string): string {
    if (/Windows/.test(ua)) return 'Windows';
    if (/Android/.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Macintosh|Mac OS X/.test(ua)) return 'macOS';
    if (/CrOS/.test(ua)) return 'ChromeOS';
    if (/Linux|X11/.test(ua)) return 'Linux';
    return 'unknown';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive coarse browser family, browser major version, and OS family from
 * navigator.userAgent. The raw user-agent string is parsed and discarded;
 * it is never returned or stored.
 *
 * @param userAgent Optional UA override for testing. Defaults to
 *   `navigator.userAgent` when available.
 */
export function collectCoarseEnvironment(userAgent?: string): CoarseEnvironment {
    const ua = userAgent
        ?? (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
            ? navigator.userAgent
            : '');
    if (!ua) return { browserFamily: 'unknown', browserMajor: '0', osFamily: 'unknown' };
    const browser = parseBrowser(ua);
    return {
        browserFamily: browser.family,
        browserMajor: browser.major,
        osFamily: parseOsFamily(ua)
    };
}

/**
 * Detect secure context and Web device API availability. Checks only for
 * the presence of the API objects; never reads their properties or calls
 * their methods.
 */
export function collectWebCapabilities(): WebCapabilities {
    const g = globalThis as Record<string, any>;
    const nav = typeof navigator !== 'undefined' ? (navigator as Record<string, any>) : undefined;
    return {
        secureContext: g.isSecureContext === true,
        webBluetooth: !!nav && typeof nav.bluetooth !== 'undefined',
        webUsb: !!nav && typeof nav.usb !== 'undefined',
        webSerial: !!nav && typeof nav.serial !== 'undefined'
    };
}

function yn(b: boolean): string {
    return b ? 'yes' : 'no';
}

function avail(b: boolean): string {
    return b ? 'available' : 'not available';
}

function buildTitle(kind: ReportKind, human: HumanDetails): string {
    const brand = sanitize(human.brand, MAX_SHORT);
    const model = sanitize(human.model, MAX_SHORT);
    const device = [brand, model].filter(Boolean).join(' ') || 'Unknown printer';
    switch (kind) {
        case 'missing-printer': return `Missing printer support: ${device}`;
        case 'print-success': return `Successful print report: ${device}`;
        case 'print-problem': return `Print problem: ${device}`;
    }
}

/**
 * Build a privacy-safe markdown body for a GitHub issue. Only the
 * allowlisted fields from {@link AutomaticDiagnostics} and sanitized
 * {@link HumanDetails} are included. Extra properties on either object
 * are ignored.
 */
export function buildReportMarkdown(kind: ReportKind, human: HumanDetails, auto: AutomaticDiagnostics): string {
    // Destructure only allowlisted fields — extras are dropped here.
    const {
        build, runtime, browserFamily, browserMajor, osFamily,
        secureContext, webBluetooth, webUsb, webSerial,
        connectionState, profileId, hardwareId, profileBrand, profileModel,
        transportKind, transportType, driverName,
        maxDensity, canvasHeightPx, supportsSpeedMode,
        colorType, colorChannels, dpmm,
        errorCode,
        pageWidthPx, pageHeightPx, pageWidthMm, pageHeightMm, mediaWidthMm,
        paperType,
        printDensity, printCopies, printSpeed, printResult,
        diagnosticCandidates
    } = auto;

    const lines: string[] = [];

    const kindLabel: Record<ReportKind, string> = {
        'missing-printer': 'Missing printer',
        'print-success': 'Successful print',
        'print-problem': 'Print problem'
    };
    lines.push(`**Report type:** ${kindLabel[kind]}`, '');

    const evidence = kind === 'print-success' && auto.printResult === 'sent'
        ? printEvidenceDimensions(auto)
        : undefined;
    if (evidence) {
        lines.push(`<!-- opentlp-print-evidence:v1 ${JSON.stringify(evidence)} -->`, '');
    }

    // --- User details ---
    lines.push('### User details', '');
    lines.push(`- **Brand:** ${sanitize(human.brand, MAX_SHORT) || 'Not provided'}`);
    lines.push(`- **Model:** ${sanitize(human.model, MAX_SHORT) || 'Not provided'}`);

    const advertisedName = sanitizeOptional(human.advertisedName, MAX_SHORT);
    if (advertisedName) lines.push(`- **Advertised name:** ${advertisedName}`);

    const firmware = sanitizeOptional(human.firmware, MAX_SHORT);
    if (firmware) lines.push(`- **Firmware:** ${firmware}`);

    const hardware = sanitizeOptional(human.hardware, MAX_SHORT);
    if (hardware) lines.push(`- **Hardware:** ${hardware}`);

    const problemCategory = sanitizeOptional(human.problemCategory, MAX_SHORT);
    if (problemCategory) lines.push(`- **Problem category:** ${problemCategory}`);
    const whatHappened = sanitizeOptional(human.whatHappened, MAX_LONG);
    if (whatHappened) lines.push(`- **What happened:** ${whatHappened}`);
    const expectedResult = sanitizeOptional(human.expectedResult, MAX_LONG);
    if (expectedResult) lines.push(`- **Expected result:** ${expectedResult}`);

    const note = sanitizeOptional(human.note, MAX_LONG);
    if (note) lines.push(`- **Note:** ${note}`);
    lines.push('');

    // --- Automatic context ---
    lines.push('### Automatic context', '');
    lines.push(`- **Build:** ${sanitize(build, MAX_SHORT)}`);
    lines.push(`- **Runtime:** ${sanitize(runtime, MAX_SHORT)}`);
    lines.push(`- **Browser:** ${sanitize(browserFamily, MAX_SHORT)} ${sanitize(browserMajor, MAX_SHORT)}`);
    lines.push(`- **OS:** ${sanitize(osFamily, MAX_SHORT)}`);
    lines.push(`- **Secure context:** ${yn(secureContext)}`);
    lines.push(`- **Web Bluetooth:** ${avail(webBluetooth)}`);
    lines.push(`- **Web USB:** ${avail(webUsb)}`);
    lines.push(`- **Web Serial:** ${avail(webSerial)}`);
    lines.push(`- **Connection state:** ${sanitize(connectionState, MAX_SHORT)}`);

    if (profileId || profileBrand || profileModel) {
        const parts: string[] = [];
        const pb = sanitizeOptional(profileBrand, MAX_SHORT);
        const pm = sanitizeOptional(profileModel, MAX_SHORT);
        const name = [pb, pm].filter(Boolean).join(' ');
        if (name) parts.push(name);
        const pid = sanitizeOptional(profileId, MAX_SHORT);
        if (pid) parts.push(`(profile: ${pid})`);
        const hid = sanitizeOptional(hardwareId, MAX_SHORT);
        if (hid) parts.push(`(hardware: ${hid})`);
        lines.push(`- **Printer profile:** ${parts.join(' ') || 'unknown'}`);
    }

    if (transportKind) lines.push(`- **Transport option:** ${sanitize(transportKind, MAX_SHORT)}`);
    if (transportType) lines.push(`- **Transport implementation:** ${sanitize(transportType, MAX_SHORT)}`);
    if (driverName) lines.push(`- **Driver:** ${sanitize(driverName, MAX_SHORT)}`);

    if (Number.isFinite(maxDensity)) lines.push(`- **Max density:** ${maxDensity}`);
    if (Number.isFinite(canvasHeightPx)) lines.push(`- **Canvas height:** ${canvasHeightPx} px`);
    if (supportsSpeedMode !== undefined) lines.push(`- **Speed mode:** ${yn(supportsSpeedMode)}`);
    if (colorType !== undefined) lines.push(`- **Color:** ${sanitize(colorType, MAX_SHORT)}`);
    if (Number.isFinite(colorChannels)) lines.push(`- **Color channels:** ${colorChannels}`);
    if (Number.isFinite(dpmm)) lines.push(`- **Resolution:** ${dpmm} dpmm`);

    if (errorCode) lines.push(`- **Error code:** ${sanitize(errorCode, MAX_SHORT)}`);

    const px = [pageWidthPx, pageHeightPx].every(v => Number.isFinite(v));
    const mm = [pageWidthMm, pageHeightMm].every(v => Number.isFinite(v));
    if (px) lines.push(`- **Page size:** ${pageWidthPx}x${pageHeightPx} px${mm ? ` (${pageWidthMm}x${pageHeightMm} mm)` : ''}`);
    if (Number.isFinite(mediaWidthMm)) lines.push(`- **Physical media width:** ${mediaWidthMm} mm`);

    if (paperType) lines.push(`- **Paper type:** ${sanitize(paperType, MAX_SHORT)}`);

    const printParts: string[] = [];
    if (Number.isFinite(printDensity)) printParts.push(`density ${printDensity}`);
    if (Number.isFinite(printCopies)) printParts.push(`${printCopies} ${printCopies === 1 ? 'copy' : 'copies'}`);
    if (Number.isFinite(printSpeed)) printParts.push(`speed ${printSpeed}`);
    if (printResult !== undefined) printParts.push(`result ${sanitize(printResult, MAX_SHORT)}`);
    if (printParts.length) lines.push(`- **Print:** ${printParts.join(', ')}`);

    const serviceUuids = safeServiceUuids(human.serviceUuids);
    if (serviceUuids.length) {
        lines.push(`- **Service UUIDs:** ${serviceUuids.map(uuid => `\`${uuid}\``).join(', ')}`);
    }
    const matchedByValues = new Set(['name', 'service', 'both', 'prefix-hint']);
    const candidates = (diagnosticCandidates ?? []).slice(0, 24).flatMap(candidate => {
        const name = sanitize(candidate.name, MAX_SHORT);
        return name && matchedByValues.has(candidate.matchedBy)
            ? [`${name} (${candidate.matchedBy})`]
            : [];
    });
    if (candidates.length) {
        lines.push(`- **Candidate drivers:** ${candidates.join(', ')}`);
    }

    lines.push('');

    const diagnosticLog = sanitizeOptional(human.diagnosticLog, MAX_LOG);
    if (diagnosticLog) {
        lines.push('### Diagnostic activity', '');
        for (const line of diagnosticLog.split(/\r?\n/).slice(0, 80)) {
            lines.push(`    ${line.slice(0, 300)}`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Build a pre-filled GitHub issue URL for the OpenTLP repository. The title
 * and body are URL-encoded; the body is the same markdown produced by
 * {@link buildReportMarkdown}.
 */
export function buildGitHubIssueUrl(kind: ReportKind, human: HumanDetails, auto: AutomaticDiagnostics): string {
    const title = buildTitle(kind, human);
    const body = buildReportMarkdown(kind, human, auto);
    return `${ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
