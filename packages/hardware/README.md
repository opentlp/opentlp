# OpenTLP Table of Hardware

The source of truth for OpenTLP printer models, protocol families, rebrands,
connectivity, evidence, and cross-project support.

A hardware entry does not imply that OpenTLP Core has a driver for it. Driver
profiles reference entries in this package; entries without a reference remain
useful catalogue and research records.

```sh
npm run validate
npm run build
```

`npm run build` writes the full `devices.json` and `families.json` exports plus a
small runtime catalogue used by OpenTLP Studio. The public website is maintained
in the separate `opentlp/table-of-hardware` repository and reads these source
files at build time.

## Linking a driver

A driver model profile is linked automatically when its `id` matches a hardware
record ID. If the IDs differ, set the profile's optional `tohId` to the hardware
record ID. Explicit links are validated by `npm run catalogue:links`.

The relationship is one-way: an explicit driver link must resolve, while a
hardware record does not need a driver. Unlinked legacy driver profiles are
reported and can be associated gradually.

## Licence

Device and protocol data is CC0-1.0. Validation and export code is MIT. Linked
sources retain their own terms.
