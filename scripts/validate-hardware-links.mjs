import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrintManager } = require('../packages/core/lib/index.js');

const catalogue = JSON.parse(
    await readFile(new URL('../packages/hardware/dist/catalogue.json', import.meta.url), 'utf8')
);
const hardwareIds = new Set(catalogue.devices.map(device => device.id));
const profiles = new PrintManager().getAvailablePrinterProfiles();
const invalid = [];
let linked = 0;

for (const profile of profiles) {
    const target = profile.tohId ?? profile.id;
    if (hardwareIds.has(target)) {
        linked += 1;
    } else if (profile.tohId) {
        invalid.push(`${profile.id} -> ${profile.tohId}`);
    }
}

if (invalid.length) {
    console.error('Invalid explicit OpenTLP hardware links:');
    for (const link of invalid) console.error(`  ${link}`);
    process.exit(1);
}

const unlinked = profiles.length - linked;
console.log(
    `Validated ${linked} linked driver profiles; ${unlinked} legacy profiles remain unlinked; ` +
    `${catalogue.devices.length} hardware records may exist with or without drivers.`
);
