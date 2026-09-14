---
id: labelife
name: Labelife
developer: AIMO Tech / Zhuhai Quin
summary: Wide desktop commercial shipping label printers communicating via TSPL commands.
brand_color: "#3d81f8"
brand_palette:
  - "#ffffff"
  - "#3d81f8"
badge_letter: "L"
platforms:
  android:
    package: com.aimo.labelife
    url: https://play.google.com/store/apps/details?id=com.aimo.labelife
  ios:
    id: 1560922539
    url: https://apps.apple.com/app/labelife/id1560922539
protocols:
  - tspl
replaces_apps:
  - Labelife
  - Phomemo
popular_models:
  - PM-241
  - PM-241BT
  - D520
is_multi_device: false
status: verified
sources:
  - kind: user-report
    url: https://apps.apple.com/app/labelife/id1560922539
    note: Official Apple App Store listing by AIMO Tech / Zhuhai Quin.
  - kind: user-report
    url: https://play.google.com/store/apps/details?id=com.aimo.labelife
    note: Official Google Play Store listing.
  - kind: protocol-capture
    note: Verified TSPL command protocol over Bluetooth Low Energy on PM-241BT.
---

## Overview

**Labelife** is the desktop and commercial shipping companion application from **AIMO Tech / Zhuhai Quin** designed for 4-inch commercial parcel printers like the PM-241, PM-241BT, and D520 series.

The app icon features a stylized azure blue folded ribbon "L" on a clean white background.

## Protocol Characteristics

Labelife printers speak the standard TSPL command protocol ([tspl](tspl.html)):
- **Transports**: BLE, USB, and serial.
- **Media**: Fanfold and rolled 4×6 inch (100×150 mm) direct thermal shipping labels.
