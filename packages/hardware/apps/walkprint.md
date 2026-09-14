---
id: walkprint
name: WalkPrint
developer: WalkPrint / efercro Team
summary: Portable thermal pocket and receipt printers using WalkPrint / V5X bulk raster protocol.
brand_color: "#8073f7"
brand_palette:
  - "#ffffff"
  - "#8073f7"
badge_letter: "W"
platforms:
  android:
    package: com.yhk.rabbit.print.walkprint
    url: https://play.google.com/store/apps/details?id=com.yhk.rabbit.print.walkprint
  ios:
    id: 1491753561
    url: https://apps.apple.com/app/walkprint/id1491753561
protocols:
  - catprinter-v5x
replaces_apps:
  - WalkPrint
  - Luck Jingle
popular_models:
  - MXW01
  - V5G
  - MX05
  - Luck Jingle
is_multi_device: false
status: verified
sources:
  - kind: user-report
    url: https://apps.apple.com/app/walkprint/id1491753561
    note: Official Apple App Store listing by efercro.
  - kind: user-report
    url: https://play.google.com/store/apps/details?id=com.yhk.rabbit.print.walkprint
    note: Official Google Play Store listing by YHK Rabbit.
  - kind: protocol-capture
    note: Packet captures verifying V5X and MXW01 framing compatibility with catprinter-v5x family.
---

## Overview

**WalkPrint** (and OEM variants such as *Luck Jingle*) is the companion app for rabbit-eared, cat-styled, and industrial pocket memo printers.

The app icon features a stylized violet-purple rabbit icon over a clean white background.

## Protocol Characteristics

WalkPrint devices typically speak the [catprinter-v5x](catprinter-v5x.html) family:
- **Packet Prefix**: Uses bulk binary packet framing with status confirmation.
- **Media**: 58 mm continuous thermal paper rolls.
