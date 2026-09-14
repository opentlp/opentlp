---
id: dolewa
name: Dolewa
developer: Dolewa Technology
summary: Portable A4 tattoo printers, pocket memo cameras, and label makers using Funny LX-D and ESC/POS raster protocols.
brand_color: "#06c9da"
brand_palette:
  - "#06c9da"
  - "#e78d14"
  - "#60d4df"
  - "#000000"
badge_letter: "D"
platforms:
  android:
    package: com.dolewa
    url: https://play.google.com/store/apps/details?id=com.dolewa
protocols:
  - funny-lx
replaces_apps:
  - Dolewa
  - Dolewa Camera
  - Dolewa A4 Printer
popular_models:
  - BH-01
  - A80
  - D80
  - DL-T1
  - M8
is_multi_device: false
status: verified
sources:
  - kind: user-report
    url: https://play.google.com/store/apps/details?id=com.dolewa
    note: Official Google Play Store listing.
  - kind: protocol-capture
    note: Reverse engineering of com.dolewa, com.dolewa.camera, and com.dolewa.a4printer APKs.
---

## Overview

**Dolewa** publishes companion applications for portable thermal camera printers, mini sticker makers, and A4 stencil/tattoo printers.

## Protocols & Sub-Apps

1. **`com.dolewa.camera`**: Direct white-label of LaiLaiXiong (`com.lailaixiong.funnyprint`), using the [funny-lx](funny-lx.html) challenge-response protocol (`0000ffe6`/`0000ffe0`, `5A 0A`/`5A 0B` CRC16 handshake).
2. **`com.dolewa.a4printer`**: Combines Funny LX challenge handshake (`1F C0 51`) with ESC/POS `FS L m` (`1C 4C 6D`) bitmap transmission over BLE service `0000ff00` and Classic SPP (`00001101`).
3. **`com.dolewa`**: Flutter multi-printer app utilizing Microchip ISSC Transparent UART (`49535343-...`).
