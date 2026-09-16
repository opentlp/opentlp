---
id: pocket-printer
name: Pocket Printer
developer: Karsten International B.V.
summary: European retail label printer (Lidl SilverCrest L13, Crafts&Co, Fichero). The L13 is the rebadged Marklife-legacy unit the official Karsten Pocket Printer app drives.
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
  - marklife
replaces_apps:
  - Pocket Printer
  - Pocket Print
popular_models:
  - L13
  - DP-L13
  - SilverCrest
  - Crafts&Co
  - Fichero
is_multi_device: false
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

## Hardware

The official **Pocket Printer** app (`com.printer.lidloffice`) was built by Xiamen Lujiang / LuckPrinter for the **Lidl Silvercrest Pocket Printer (L13)** — a rebadged 15 mm Marklife-legacy label maker sold under the Lidl *SilverCrest*, Action *Crafts & Co*, and *Fichero* brands. It speaks the [marklife](marklife.html) protocol's legacy `10 FF` job path (`10 FF F1 02` … `GS v 0` … `10 FF F1 45`).

> The 58 mm continuous *Mini-Pocket-Printer* also sold under SilverCrest is **not** driven by this app — it is a Tiny Print (0x51/0x78) rebadge handled by the [tiny](tiny.html) family and the **Tiny Print** / **iPrint** companion apps. Earlier community catalogs conflated the two under a single "Pocket Printer" profile; OpenTLP keeps them separate.
