/**
 * Aggregate machine-readable successful-print reports from public GitHub issues.
 *
 * Each combination counts a GitHub account once. Invalid/spam issues and bot
 * authors are ignored. The generated file contains counts only—never account
 * names or issue text—and is consumed by Studio and the Table of Hardware.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { aggregatePrintEvidence } from './lib/print-evidence.mjs';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY ?? 'opentlp/opentlp';
const output = resolve(process.env.PRINT_EVIDENCE_OUTPUT ?? 'temp/print-evidence.json');

if (!token) throw new Error('GITHUB_TOKEN is required to aggregate public print evidence.');

async function listIssues() {
    const issues = [];
    for (let page = 1; ; page += 1) {
        const response = await fetch(`https://api.github.com/repos/${repository}/issues?state=all&per_page=100&page=${page}`, {
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'OpenTLP-print-evidence-builder'
            }
        });
        if (!response.ok) throw new Error(`GitHub issues API returned ${response.status}.`);
        const pageItems = await response.json();
        issues.push(...pageItems);
        if (pageItems.length < 100) break;
    }
    return issues;
}

// Must match DEFAULT_PRINT_EVIDENCE_THRESHOLD in reporting/report.ts.
const index = aggregatePrintEvidence(await listIssues(), new Date().toISOString(), 3);

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
console.log(`Wrote ${index.combinations.length} successful-print evidence combinations.`);
