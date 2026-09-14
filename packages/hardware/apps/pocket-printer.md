---
id: pocket-printer
name: Pocket Printer
developer: Karsten International B.V.
summary: European retail pocket and label printers (Action, Lidl SilverCrest, Crafts&Co). Supports both Pocket Printer (58mm) and Label Printer (L13) protocols.
brand_color: "#0068a0"
brand_palette:
  - "#0068a0"
  - "#284cc8"
  - "#ffffff"
badge_letter: "P"
platforms:
  android:
    package: com.printer.lidloffice
    url: https://play.google.com/store/apps/details?id=com.printer.lidloffice
  ios:
    id: 6444190726
    url: https://apps.apple.com/app/pocket-printer/id6444190726
protocols:
  - catprinter-v5x
  - marklife-1f
replaces_apps:
  - Pocket Printer
  - Pocket Print
popular_models:
  - L13
  - DP-L13
  - SilverCrest
  - Crafts&Co
  - Fichero
is_multi_device: true
status: verified
sources:
  - kind: user-report
    url: https://apps.apple.com/app/pocket-printer/id6444190726
    note: Official Apple App Store listing by Karsten International B.V.
  - kind: user-report
    url: https://play.google.com/store/apps/details?id=com.printer.lidloffice
    note: Official Google Play Store listing (com.printer.lidloffice).
  - kind: protocol-capture
    note: BLE communication captures validating dual-protocol dispatch between 58mm thermal receipts and 15mm Marklife tape.
---

## Overview

**Pocket Printer** is a companion app published primarily by **Karsten International B.V.** (Amsterdam, Netherlands) for thermal printers distributed widely through major European retail chains including Lidl (under the *SilverCrest* house brand), Action (*Crafts & Co*, *Fichero*), and various discount retail outlets.

## Dual-Protocol Architecture

Pocket Printer is a **multi-device application**. Unlike single-protocol companion apps, the app bundles two completely unrelated driver engines depending on which device model the user connects:

1. **Continuous 58 mm Pocket Printers**: Communicates using the [catprinter-v5x](catprinter-v5x.html) protocol family (GB01, MX-series variants).
2. **15 mm Tape Label Makers**: Communicates using the [marklife-1f](marklife-1f.html) protocol family, specifically the OEM Marklife L13 platform sold under Lidl SilverCrest and Crafts & Co branding.

OpenTLP detects this distinction and provides protocol disambiguation when Pocket Printer is selected.
