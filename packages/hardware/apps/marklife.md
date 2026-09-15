---
id: marklife
name: Marklife
developer: Marklife / Zhuhai Quin
summary: Compact thermal tape and die-cut label makers using the Marklife 0x1F protocol.
brand_color: "#fb4e48"
brand_palette:
  - "#ffffff"
  - "#fb4e48"
badge_letter: "M"
platforms:
  android:
    package: com.feioou.deliprint.yxq
    url: https://play.google.com/store/apps/details?id=com.feioou.deliprint.yxq
  ios:
    id: 1540535142
    url: https://apps.apple.com/app/marklife/id1540535142
protocols:
  - marklife
replaces_apps:
  - Marklife
popular_models:
  - P12
  - P11
  - P15
  - P50
  - M1
is_multi_device: false
status: verified
sources:
  - kind: user-report
    url: https://play.google.com/store/apps/details?id=com.feioou.deliprint.yxq
    note: Official Google Play Store listing by Zhuhai Yinxiaoqian / DeliPrint.
  - kind: user-report
    url: https://apps.apple.com/app/marklife/id1540535142
    note: Official Apple App Store listing.
  - kind: protocol-capture
    note: Captured 0x1F framing packets from P12 and P11 hardware sessions.
---

## Overview

**Marklife** is the official mobile companion app for the Marklife series of portable continuous and die-cut label makers manufactured by Zhuhai Quin / DeliPrint.

The app icon features a salmon/coral red bird/origami emblem on a pure white background.

## Protocol & Wire Format

All standard Marklife printers driven by this application communicate over Bluetooth Low Energy using the [marklife](marklife.html) command set:
- **Packet Prefix**: `0x1F`
- **Compression**: Custom zlib compression with non-default `windowBits: 10` (stream header `28 91`).
- **Telemetry**: Bidirectional status reporting indicating battery percentage, loaded label tape dimensions, gap markers, and print errors.
