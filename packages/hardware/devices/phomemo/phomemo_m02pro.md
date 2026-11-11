---
id: phomemo_m02pro
brand: Phomemo
model: M02 Pro
aliases:
  - M02PRO
  - sandymaro

protocol:
  family: phomemo-m02

print:
  width_dots: 576
  media_width_mm: 53
  dpi: 300
  colour: monochrome

connectivity:
  ble:
    service_uuid: 0000ff00-0000-1000-8000-00805f9b34fb
    write_uuid: 0000ff02-0000-1000-8000-00805f9b34fb
    notify_uuid: 0000ff03-0000-1000-8000-00805f9b34fb
    name_pattern: "(?:M02 Pro|M02PRO|sandymaro)"

support:
  blewebler2:
    level: listed
    notes: Experimental M02 driver; exact advertising aliases added in 9c6a92a.

status: unverified

sources:
  - kind: vendor-doc
    url: https://play.google.com/store/apps/details?id=com.quyin.phomemo
    title: Phomemo 4.0.0 Android SDK
    note: >-
      APK versionCode 338, SHA-256 ffa6b379f4d3c2061b3e9ae6424a84229c25042360ec7fc953a488bbaf23ac00.
      Model factory Bk.a maps M02 Pro and sandymaro to Ck.d, inheriting Dk.c's
      576-dot roll bitmap and 0.0847 mm dot pitch; Dk.a declares 53 mm roll stock.
  - kind: oss-project
    url: https://github.com/josb25/BleWebler2/commit/9c6a92a
    licence: MIT
    note: Historical implementation used a 78-byte profile, superseded by the vendor SDK's 576-dot roll geometry.
  - kind: oss-project
    url: https://github.com/Dejniel/TiMini-Print/tree/a9a456c4243132bad52c500e39bdec221fe98db9
    licence: Apache-2.0
    note: Catalogues M02PRO and sandymaro as exact advertising names for M02 Pro.
  - kind: oss-project
    url: https://github.com/transcriptionstream/phomymo
    note: >-
      Lists this model as supported. Its README states MIT but the repository
      carries no licence file, so only factual claims are taken from it.
---

Listed as supported by [phomymo](https://github.com/transcriptionstream/phomymo).
Nothing here has been confirmed against hardware.

## Printable width

Phomemo 4.0.0's SDK allocates a 576-dot bitmap for roll media at a 0.0847 mm
dot pitch (300 dpi). Its default roll stock is 53 mm wide. A 576-dot raster
uses 72 bytes per row; stock width and printable width are different fields.

phomymo states 626 dots and 53 mm, with a 78-byte (624-dot) wire-width table.
That historical value differs from the vendor SDK. Physical output remains
unverified.

## Not yet recorded

Mechanism, media handling, power, indicators and what the printer reports back.
