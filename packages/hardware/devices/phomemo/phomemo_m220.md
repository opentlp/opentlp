---
id: phomemo_m220
brand: Phomemo
model: M220

protocol:
  family: phomemo-m110

print:
  width_dots: 576
  width_mm: 72
  dpi: 203
  colour: monochrome

connectivity:
  ble:
    service_uuid: 0000ff00-0000-1000-8000-00805f9b34fb
    write_uuid: 0000ff02-0000-1000-8000-00805f9b34fb
    notify_uuid: 0000ff03-0000-1000-8000-00805f9b34fb
    name_pattern: "(?:M220|Q054|Q155)"

support:
  phomemo-tools:
    level: listed
    notes: Named in the project's supported-model list.
  blewebler2:
    level: listed
    notes: Experimental family driver added in ab8fbb7; awaiting hardware validation.

status: unverified

sources:
  - kind: vendor-doc
    url: https://play.google.com/store/apps/details?id=com.project.aimotech.printmaster
    title: Print Master 5.21.1 Android SDK
    note: >-
      APK versionCode 5210102, SHA-256 e7e7c6f43b3d65514cbdde3fe3b31b46adcb2ccfc780b5f059f9eb6887fd5f27.
      DefaultPrinter.json maps Q054 and Q155 to M220 in series M200. M220Printer
      inherits M200Printer; ImageTransformFactory declares 576 dots and 72 mm
      for M220. Label rotation is configurable in PrintImageTransform.
  - kind: oss-project
    url: https://github.com/josb25/BleWebler2/commit/ab8fbb7
    licence: MIT
    note: Implements the documented command family with a 576-dot experimental profile.
  - kind: oss-project
    url: https://github.com/vivier/phomemo-tools
    licence: GPL-3.0
    note: Documents the command set and per-model line widths.
  - kind: oss-project
    url: https://github.com/transcriptionstream/phomymo
    note: >-
      Lists supported models and widths. Its README states MIT but the
      repository carries no licence file, so only factual claims are taken
      from it.
  - kind: catalogue
    note: >-
      Transcribed from a driver's model table; specifications not confirmed against hardware.
---

Print Master 5.21.1's SDK records a 576-dot, 72 mm printable width for M220.
Its M220 printer class inherits the M200 class and uses the shared Quin
ESC/POS raster command path. The mechanism, media handling and status reporting
are unrecorded.

## Earlier width claims

Three sources disagree, and none of them is a measurement:

| Source | Claim |
|---|---|
| phomymo | 576 dots, 72 mm |
| phomemo-tools | 344 dots (43 bytes per line) |
| a driver model table | 384 dots |

The recorded width follows the vendor SDK. Physical output remains unverified.
