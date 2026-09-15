---
id: nelko_p21
brand: Nelko
model: P21
summary: 96-dot 12 mm Bluetooth Classic label printer speaking a TSPL2 subset over SPP/RFCOMM.
protocol:
  family: nelko-p21
  app: Nelko
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
  paper_drm: circumventable
connectivity:
  serial: true
support:
  blewebler2:
    level: listed
    notes: >-
      Experimental TSPL2-subset driver over Bluetooth Classic / serial; the
      `\x1b!o` cancel-pause preamble and SIZE/GAP/DIRECTION/DENSITY/CLS/BITMAP/
      PRINT job order are implemented. Proprietary BATTERY?/CONFIG? queries are
      out of scope.
status: unverified
sources:
  - kind: oss-project
    url: https://github.com/merlinschumacher/nelko-p21-print
    licence: AGPL-3.0
    note: >-
      Wireshark Bluetooth capture and Python script establishing the SPP
      transport, cancel-pause preamble, TSPL2 job order, 96-dot/12-byte
      MSB-first raster, BCD BATTERY? reply and CONFIG? firmware layout.
      AGPL-3.0 code is not redistributed; only protocol facts were used.
  - kind: oss-project
    url: https://github.com/TylerCode/Fyne-P21-Print
    licence: MIT
    note: >-
      Independent Go/Fyne implementation corroborating the 96-dot 12-mm
      geometry, 115200 8N1 serial framing, the cancel-pause preamble and the
      same TSPL2 subset. MIT-licensed; protocol facts only, no source copied.
  - kind: vendor-doc
    url: https://github.com/merlinschumacher/nelko-p21-print#readme
    retrieved: 2026-09-15
    note: >-
      README documents the P21 as a Bluetooth Classic (SPP/RFCOMM) label
      printer using a TSPL2 command subset, an NFC consumable reader that
      doubles as soft DRM, and a JieLi AC6951C-series Bluetooth chip.
---

The Nelko P21 is a 203-dpi, 96-dot direct-thermal label printer that
communicates over a Bluetooth Classic SPP / RFCOMM serial channel at 115200
baud, 8N1. It is unrelated to the PeriPage raw-raster P21 despite the shared
model stem: this device speaks TSPL2 text commands with a binary BITMAP
payload, not the ESC/POS `GS v 0` raster encoder.

Web Bluetooth cannot connect to the P21 because it advertises no GATT service;
pair it in OS Bluetooth settings and select the resulting serial port
(`COM*` on Windows, `/dev/rfcomm*` on Linux, `/dev/cu.*` on macOS).

## Consumable identification

The P21 has an internal NFC reader that identifies the loaded label roll and
auto-determines the label format. It also acts as soft DRM: the official app
complains when third-party rolls are used, though third-party stock reportedly
works regardless.

## Not yet recorded

Exact media-width range, cutter geometry, power, indicators and status replies
await a hardware report.
