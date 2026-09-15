---
id: luck-jingle
name: Luck Jingle
developer: Xiamen Lujiang Technology Co., Ltd.
summary: Portable Bluetooth thermal label makers and mini pocket printers using the LuckPrinter ESC/POS and flow-control protocol.
brand_color: "#0670e8"
brand_palette:
  - "#0670e8"
  - "#ffcd34"
  - "#ffffff"
  - "#000000"
badge_letter: "L"
platforms:
  android:
    package: com.dingdang.newprint
    url: https://play.google.com/store/apps/details?id=com.dingdang.newprint
  ios:
    id: 1533722247
    url: https://apps.apple.com/app/luck-jingle/id1533722247
protocols:
  - marklife
replaces_apps:
  - Luck Jingle
  - LuckPrinter
popular_models:
  - L13
  - L12
  - DPS1
  - D80
  - A80
  - ITP05
  - L80
is_multi_device: false
status: verified
sources:
  - kind: user-report
    url: https://play.google.com/store/apps/details?id=com.dingdang.newprint
    note: Official Google Play Store listing by Xiamen Lujiang Technology Co., Ltd.
  - kind: protocol-capture
    note: Captured 0000ff00 GATT communication packets and credit flow control exchange from APK runtime.
---

## Overview

**Luck Jingle** (published by **Xiamen Lujiang Technology Co., Ltd.**) is the official companion application for LuckPrinter hardware and an extensive catalog of 70+ OEM pocket, label, shipping, and tattoo stencil printers.

## Protocol & Wire Format

Printers driven by Luck Jingle communicate over Bluetooth Low Energy using the ESC/POS raster and credit flow control dialect:
- **Service UUID**: `0000ff00-0000-1000-8000-00805f9b34fb`
- **Write Characteristic**: `0000ff02-0000-1000-8000-00805f9b34fb`
- **Notify / Status**: `0000ff01-0000-1000-8000-00805f9b34fb`
- **Credit Flow Control**: `0000ff03-0000-1000-8000-00805f9b34fb`
- **Framing**: 12-byte zero wake preamble, `10 FF F1 03` enable, `GS v 0` raster stream, and `10 FF F1 45` job termination.
