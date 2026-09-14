---
id: marklife_l13
brand: Marklife
model: L13
aliases:
  - SilverCrest
  - MUNBYN
  - luckjingle
  - Karsten International
  - Crafts&Co
  - Fichero
summary: 15 mm label maker sold under several brands (SilverCrest, Crafts&Co, MUNBYN); companion to Karsten International's Pocket Printer app and speaks Marklife legacy protocol.

protocol:
  family: marklife-1f
  packet_prefix: "1f"
  app: Pocket Printer
  replaces_apps:
    - Pocket Printer
    - Pocket Print

print:
  width_dots: 96
  width_mm: 12
  media_width_mm: 15
  dpi: 203
  media: [gap, continuous]
  colour: monochrome
  colour_planes: 1
  max_density: 15
  speed_mode: false

mechanism:
  cutter: false

connectivity:
  ble:
    service_uuid: 0000ff00-0000-1000-8000-00805f9b34fb
    write_uuid: 0000ff02-0000-1000-8000-00805f9b34fb
    name_pattern: "L13"
    name_examples: [L13, DP-L13]

reports: [battery, faults, device-name, serial-number, firmware-version, hardware-version]

status: verified

sources:
  - kind: user-report
    note: Printed from; no cutter fitted.
  - kind: protocol-capture
    note: BLE traffic captured against the physical unit.
---

## Companion App & Karsten International

The primary European companion app for this printer is **Pocket Printer** by **Karsten International B.V.**
(distributed via retail chains such as Action and Lidl under the Silvercrest, Crafts&Co, and Fichero brands).

Inside the Pocket Printer app, users are asked to select between:
1. **Label Printer**: This 15 mm Marklife-legacy L13 unit (firmware reports `DP-L13` or `L13`).
2. **Pocket Printer**: A wider continuous 58 mm thermal pocket printer.

## Relationship to the P12

The L13 and the [P12](marklife_p12.html) share a protocol family but are not the same
hardware. The L13 has no cutter. The L13 speaks the Marklife legacy dialect (LP90/L13 framing with 0x03 printer type).

## Protocol notes

- Wire-identical to the P12, including the `windowBits: 10` zlib requirement and
  the status replies.
- The firmware reports `DP-L13` regardless of the brand on the packaging.
- No Marklife-branded L13 exists. The `brand` field records the protocol family,
  not a name on a box.

## Not yet recorded

Which badges it ships under. A full comparison against the P12 — the cutter is
the only difference confirmed so far.
