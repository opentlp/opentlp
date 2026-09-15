const MARKER = /<!--\s*opentlp-print-evidence:v1\s+(\{[\s\S]*?\})\s*-->/;
const BLOCKED_LABELS = new Set(['invalid', 'spam']);
const PAPER_TYPES = new Set([
    'gap', 'continuous', 'transparent', 'black', 'perforated',
    'pvc', 'black-mark', 'heat-shrink'
]);
const REQUIRED_STRINGS = [
    'hardwareId', 'profileId', 'driverId', 'transportKind',
    'transportType', 'runtime', 'osFamily'
];

export function parsePrintEvidenceIssue(issue) {
    if (issue?.pull_request || issue?.user?.type === 'Bot' || !issue?.user?.login) return undefined;
    if (issue.labels?.some(label => BLOCKED_LABELS.has(String(label.name).toLowerCase()))) return undefined;
    const match = String(issue.body ?? '').match(MARKER);
    if (!match) return undefined;
    try {
        const value = JSON.parse(match[1]);
        if (!validDimensions(value)) return undefined;
        return {
            reporter: issue.user.login.toLowerCase(),
            dimensions: canonicalDimensions(value)
        };
    } catch {
        return undefined;
    }
}

export function aggregatePrintEvidence(issues, generatedAt = new Date().toISOString(), threshold = 3) {
    const combinations = new Map();
    for (const issue of issues) {
        const parsed = parsePrintEvidenceIssue(issue);
        if (!parsed) continue;
        const key = JSON.stringify(parsed.dimensions);
        const entry = combinations.get(key) ?? { dimensions: parsed.dimensions, reporters: new Set() };
        entry.reporters.add(parsed.reporter);
        combinations.set(key, entry);
    }
    return {
        schemaVersion: 1,
        generatedAt,
        threshold,
        combinations: [...combinations.values()]
            .map(entry => ({ dimensions: entry.dimensions, confirmations: entry.reporters.size }))
            .sort((a, b) => b.confirmations - a.confirmations || a.dimensions.hardwareId.localeCompare(b.dimensions.hardwareId))
    };
}

function validDimensions(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (!REQUIRED_STRINGS.every(key => typeof value[key] === 'string' && value[key].length > 0 && value[key].length <= 200)) return false;
    return PAPER_TYPES.has(value.paperType)
        && Number.isFinite(value.dpmm)
        && value.dpmm > 0
        && Number.isFinite(value.mediaWidthMm)
        && value.mediaWidthMm > 0;
}

function canonicalDimensions(value) {
    return {
        hardwareId: value.hardwareId,
        profileId: value.profileId,
        driverId: value.driverId,
        driverName: value.driverName,
        transportKind: value.transportKind,
        transportType: value.transportType,
        runtime: value.runtime,
        osFamily: value.osFamily,
        paperType: value.paperType,
        dpmm: value.dpmm,
        mediaWidthMm: value.mediaWidthMm
    };
}
