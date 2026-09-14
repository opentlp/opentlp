---
id: phomemo
name: Phomemo
developer: Zhuhai Quin Technology Co., Ltd.
summary: Popular thermal printers spanning portable pocket note printers (M02) and versatile label printers.
brand_color: "#fe677c"
brand_palette:
  - "#ffffff"
  - "#fe677c"
  - "#fc3f54"
badge_letter: "P"
platforms:
  android:
    package: com.quyin.phomemo
    url: https://play.google.com/store/apps/details?id=com.quyin.phomemo
  ios:
    id: 1456102145
    url: https://apps.apple.com/app/phomemo/id1456102145
protocols:
  - phomemo-m02
  - phomemo-m-series
  - phomemo-m04
  - phomemo-m110
  - phomemo-p12
replaces_apps:
  - Phomemo
  - Print Master
popular_models:
  - M02
  - M04
  - T02
  - M02S
  - M110
is_multi_device: true
status: verified
sources:
  - kind: user-report
    url: https://apps.apple.com/app/phomemo/id1456102145
    note: Official Apple App Store listing by Zhuhai Quin Technology Co., Ltd.
  - kind: user-report
    url: https://play.google.com/store/apps/details?id=com.quyin.phomemo
    note: Official Google Play Store listing by QY Tech.
  - kind: protocol-capture
    note: Traffic captures across M02 (continuous) and M110 (label) verifying protocol family separation.
---

## Overview

**Phomemo** is the flagship consumer application from **Zhuhai Quin Technology Co., Ltd.** supporting their extensive ecosystem of thermal pocket printers and mini label makers.

The app icon displays a retro coral-watermelon camera/printer glyph on a clean white background.

## Multi-Protocol Architecture

The Phomemo app serves two distinct classes of thermal printing hardware:
1. **Continuous Pocket Printers**: [phomemo-m02](phomemo-m02.html), [phomemo-m-series](phomemo-m-series.html), and [phomemo-m04](phomemo-m04.html).
2. **Die-cut and Tape Label Makers**: [phomemo-m110](phomemo-m110.html) and [phomemo-p12](phomemo-p12.html).

OpenTLP provides protocol disambiguation when pairing devices associated with the Phomemo application.
