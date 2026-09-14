---
id: peripage
name: PeriPage
developer: Xiamen iLead Tek Co., Ltd.
summary: Bear-styled 58mm and 80mm pocket printers using standard ESC/POS raster framing.
brand_color: "#3fad34"
brand_palette:
  - "#3fad34"
  - "#ffffff"
  - "#332d2b"
badge_letter: "P"
platforms:
  android:
    package: com.ileadtek.peripage
    url: https://play.google.com/store/apps/details?id=com.ileadtek.peripage
  ios:
    id: 1508457132
    url: https://apps.apple.com/app/peripage/id1508457132
protocols:
  - peripage-raw-gsv0
replaces_apps:
  - PeriPage
popular_models:
  - A6
  - A9
  - C6
  - A8
  - A6+
is_multi_device: false
status: verified
sources:
  - kind: user-report
    url: https://apps.apple.com/app/peripage/id1508457132
    note: Official Apple App Store listing by Xiamen iLead Tek Co., Ltd.
  - kind: user-report
    url: https://play.google.com/store/apps/details?id=com.ileadtek.peripage
    note: Official Google Play Store listing.
  - kind: protocol-capture
    note: Packet captures verifying standard ESC/POS GS v 0 raster framing on A6 and A6+ hardware.
---

## Overview

**PeriPage** is the official mobile application developed by **Xiamen iLead Tek Co., Ltd.** for their bear-faced A6, A8, and A9 pocket memo printers.

The app icon features a playful white cartoon bear on an apple-green background.

## Protocol Characteristics

PeriPage printers communicate using standard ESC/POS raster commands ([peripage-raw-gsv0](peripage-raw-gsv0.html)):
- **Raster Command**: Standard `GS v 0` raster bitmap streams.
- **Hardware Sizes**: Supports 58 mm (A6) and 80 mm (A9) widths at 203 or 304 DPI.
