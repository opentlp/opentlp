import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aggregatePrintEvidence, parsePrintEvidenceIssue } from './lib/print-evidence.mjs';

const dimensions = {
    hardwareId: 'marklife-p12',
    profileId: 'marklife_p12',
    driverName: 'Marklife (Protocol 0x1F)',
    transportKind: 'web-bluetooth',
    transportType: 'Web Bluetooth',
    runtime: 'web',
    osFamily: 'Windows',
    paperType: 'continuous',
    dpmm: 8,
    mediaWidthMm: 12
};

function issue(login, value = dimensions, extra = {}) {
    return {
        body: `Success\n<!-- opentlp-print-evidence:v1 ${JSON.stringify(value)} -->`,
        user: { login, type: 'User' },
        labels: [],
        ...extra
    };
}

describe('print evidence aggregation', () => {
    it('counts one confirmation per account and exact combination', () => {
        const result = aggregatePrintEvidence([
            issue('Alice'), issue('alice'), issue('Bob'),
            issue('Alice', { ...dimensions, transportType: 'Web Serial' })
        ], '2026-09-13T00:00:00.000Z');
        assert.equal(result.combinations.length, 2);
        assert.equal(result.combinations[0].confirmations, 2);
        assert.equal(result.combinations[1].confirmations, 1);
    });

    it('ignores bots, pull requests, invalid labels and malformed dimensions', () => {
        const issues = [
            issue('Bot', dimensions, { user: { login: 'Bot', type: 'Bot' } }),
            issue('PR', dimensions, { pull_request: {} }),
            issue('Spam', dimensions, { labels: [{ name: 'SPAM' }] }),
            issue('BadPaper', { ...dimensions, paperType: 'typo' }),
            issue('BadWidth', { ...dimensions, mediaWidthMm: 0 })
        ];
        assert.equal(aggregatePrintEvidence(issues).combinations.length, 0);
    });

    it('accepts a line-wrapped marker and drops extra keys', () => {
        const wrapped = issue('Alice');
        wrapped.body = `<!-- opentlp-print-evidence:v1\n${JSON.stringify({ ...dimensions, ignored: 'value' }, null, 2)}\n-->`;
        const parsed = parsePrintEvidenceIssue(wrapped);
        assert.deepEqual(parsed?.dimensions, dimensions);
        assert.equal('ignored' in parsed.dimensions, false);
    });
});
