---
id: flashlabel
name: FlashLabel
developer: Xiamen Angyin Information Technology
summary: Desktop shipping and thermal barcode printers using TSPL/CPCL protocol.
brand_color: "#1d5a9d"
brand_palette:
  - "#ffffff"
  - "#1d5a9d"
  - "#429afd"
badge_letter: "F"
platforms:
  android:
    package: cn.angyin.flashlabel
    url: https://play.google.com/store/apps/details?id=cn.angyin.flashlabel
  ios:
    id: 1619933168
    url: https://apps.apple.com/app/flashlabel/id1619933168
protocols:
  - tspl
replaces_apps:
  - FlashLabel
  - Orgsta
popular_models:
  - Orgsta S001
  - Y486
  - A318
is_multi_device: false
status: verified
sources:
  - kind: user-report
    url: https://apps.apple.com/app/flashlabel/id1619933168
    note: Official Apple App Store listing by Xiamen Angyin Information Technology.
  - kind: user-report
    url: https://play.google.com/store/apps/details?id=cn.angyin.flashlabel
    note: Official Google Play Store listing.
  - kind: protocol-capture
    note: Verified TSPL ASCII command stream transmission over BLE and USB.
---

## Overview

**FlashLabel** (and white-label rebrands such as *Orgsta*) is a mobile configuration and printing tool for desktop 4-inch (104 mm) thermal shipping label and barcode printers.

The app icon displays a dark navy and cyan printer emblem on a clean white background.

## Protocol Characteristics

FlashLabel hardware speaks standard TSPL printer language ([tspl](tspl.html)):
- **Command Set**: Standard ASCII TSPL commands (`SIZE`, `GAP`, `BITMAP`, `PRINT`).
- **Media**: 4×6 inch commercial shipping waybills and wide warehouse barcodes.
