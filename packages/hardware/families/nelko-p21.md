---
id: nelko-p21
name: Nelko P21 TSPL2
summary: Nelko's TSPL2-derived label protocol over Bluetooth Classic SPP, with a cancel-pause preamble and proprietary status queries.
also_known_as: [Nelko P21 protocol]
based_on: TSPL2
transports: [serial]
acknowledges: false
raster:
  bit_order: msb-first
  polarity: 1-is-black
  row_padding: byte
  width_unit: bytes
  compression:
    algorithm: none
flow:
  max_write_bytes: 512
  control: none
commands:
  - opcode: 1b 21 6f
    name: Cancel pause
    status: confirmed
  - opcode: 53 49 5a 45
    name: SIZE
    payload: label width and height in mm
    description: ASCII `SIZE <w> mm,<h> mm` followed by CRLF.
  - opcode: 47 41 50
    name: GAP
    payload: gap and offset in mm
  - opcode: 44 49 52 45 43 54 49 4f 4e
    name: DIRECTION
    payload: direction and mirror flags
  - opcode: 44 45 4e 53 49 54 59
    name: DENSITY
    payload: level 0-15
  - opcode: 43 4c 53
    name: CLS
  - opcode: 42 49 54 4d 41 50
    name: BITMAP
    payload: x, y, width bytes, height dots, mode, binary raster
    description: ASCII header terminated by a comma, then `width * height` binary MSB-first bytes, then CRLF.
  - opcode: 50 52 49 4e 54
    name: PRINT
    payload: copies
  - opcode: 42 41 54 54 45 52 59 3f
    name: BATTERY query
    direction: to-printer
    status: confirmed
    description: Proprietary ASCII query; replies `BATTERY ` then two bytes (BCD level, charging flag). Not implemented for printing.
  - opcode: 43 4f 4e 46 49 47 3f
    name: CONFIG query
    direction: to-printer
    status: confirmed
    description: Proprietary ASCII query; replies with DPI, firmware versions, timeout and beep settings. Not implemented for printing.
implementations:
  - project: blewebler2
    module: packages/core/src/drivers/nelko-p21
    url: https://github.com/opentlp/opentlp/tree/main/packages/core/src/drivers/nelko-p21
    note: Clean-room TSPL2-subset driver written from protocol facts; proprietary queries are out of scope for printing.
status: reported
sources:
  - kind: oss-project
    url: https://github.com/merlinschumacher/nelko-p21-print
    licence: AGPL-3.0
    note: >-
      Bluetooth traffic capture and Python script documenting the P21's
      SPP/RFCOMM transport, the `\x1b!o` cancel-pause preamble, the SIZE/GAP/
      DIRECTION/DENSITY/CLS/BITMAP/PRINT job order, the 96-dot/12-byte MSB-first
      raster, the BCD BATTERY? reply and the CONFIG? firmware layout. AGPL-3.0
      code is not redistributed; only uncopyrightable protocol facts were used.
  - kind: oss-project
    url: https://github.com/TylerCode/Fyne-P21-Print
    licence: MIT
    note: >-
      Independent Go/Fyne implementation corroborating the 96-dot 12-mm
      geometry, the cancel-pause preamble, 115200 8N1 serial framing and the
      same TSPL2 subset. MIT-licensed; protocol facts only, no source copied.
  - kind: standard
    url: https://fs.tscprinters.com/system/files/31-0000001-00_tspl_tspl2_programming_3_0.pdf
    note: TSC's official TSPL2 programming manual defines the SIZE/GAP/DIRECTION/DENSITY/CLS/BITMAP/PRINT directives and BITMAP layout this family is based on.
---

Nelko's P21 speaks a TSPL2-derived, line-oriented protocol over a Bluetooth
Classic SPP / RFCOMM serial channel at 115200 baud, 8N1. It is unrelated to the
PeriPage raw-raster family despite the shared `P21` model stem: the PeriPage
device uses an ESC/POS `GS v 0` raster encoder, while the Nelko device uses
TSPL2 text commands with a binary BITMAP payload.

Each print job opens with an `\x1b!o` escape sequence to cancel a paused print
state, followed by `SIZE`, `GAP`, `DIRECTION`, `DENSITY`, `CLS`, `BITMAP` and
`PRINT`. Commands are ASCII terminated with CRLF; `BITMAP` is the exception,
its comma-terminated ASCII header is followed immediately by the binary raster
bytes and then CRLF.

The P21 augments TSPL2 with proprietary queries (`BATTERY?`, `CONFIG?`) and an
NFC-based consumable identification that doubles as soft DRM. These are out of
scope for printing and are not implemented by the OpenTLP driver.

## Identification

The printer advertises no GATT service that identifies it over BLE; discovery
is by the paired serial port name, which carries the `Nelko` brand or `P21`
model string. Web Bluetooth cannot connect; pair the device in OS settings and
select the resulting serial port (`COM*`, `/dev/rfcomm*`, `/dev/cu.*`).

The bare `P21` stem is ambiguous with PeriPage's raw-raster P21, but the
PeriPage driver only matches `PeriPage`/`PPG`-prefixed resolution-qualified
names, so a `Nelko`-prefixed or bare `P21` reaches this family without
collision.
