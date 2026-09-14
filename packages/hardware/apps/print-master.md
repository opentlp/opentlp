---
id: print-master
name: Print Master
developer: AIMO Tech / Zhuhai Quin
summary: Official app for portable Phomemo/AIMO die-cut label makers.
brand_color: "#e53a38"
brand_palette:
  - "#e53a38"
  - "#ffffff"
badge_letter: "P"
platforms:
  android:
    package: com.project.aimotech.printmaster
    url: https://play.google.com/store/apps/details?id=com.project.aimotech.printmaster
  ios:
    id: 1467113436
    url: https://apps.apple.com/app/print-master/id1467113436
protocols:
  - phomemo-m110
  - phomemo-p12
replaces_apps:
  - Print Master
  - Phomemo
popular_models:
  - M110
  - M220
  - D30
  - M120
  - Q30
is_multi_device: false
status: verified
sources:
  - kind: user-report
    url: https://apps.apple.com/app/print-master/id1467113436
    note: Official Apple App Store listing by Zhuhai Quin / AIMO Tech.
  - kind: user-report
    url: https://play.google.com/store/apps/details?id=com.project.aimotech.printmaster
    note: Official Google Play Store listing.
  - kind: protocol-capture
    note: Captures on M110 and D30 verifying Phomemo label command set.
---

## Overview

**Print Master** is the dedicated commercial label app developed by **AIMO Tech / Zhuhai Quin Technology Co., Ltd.** for their die-cut label printers (M110, M220, M120) and compact tape labelers (D30, Q30).

The app icon features a vivid red rounded background with a white minimalist label maker glyph dispensing a label.

## Protocols

Printers supported by Print Master communicate using the Phomemo label protocols:
- **Die-cut Series (M110, M220)**: Operates via the [phomemo-m110](phomemo-m110.html) command format.
- **Continuous Tape (P12)**: Operates via the [phomemo-p12](phomemo-p12.html) format.
