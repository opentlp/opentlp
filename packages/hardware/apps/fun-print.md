---
id: fun-print
name: Fun Print
developer: Fun Print / Funny Print Team
summary: Mini thermal memo and sticker printers running the Funny Print LX-D raster protocol.
brand_color: "#f95959"
brand_palette:
  - "#f95959"
  - "#ffffff"
badge_letter: "F"
platforms:
  android:
    package: com.yintibao.funprint
    url: https://play.google.com/store/apps/details?id=com.yintibao.funprint
  ios:
    id: 1592740556
    url: https://apps.apple.com/app/fun-print/id1592740556
protocols:
  - funny-lx
replaces_apps:
  - Fun Print
  - Funny Print
popular_models:
  - BH-01
  - LX-D01
  - LX-D02
  - LX-D09
is_multi_device: false
status: verified
sources:
  - kind: user-report
    url: https://apps.apple.com/app/fun-print/id1592740556
    note: Official Apple App Store listing by Yintibao.
  - kind: user-report
    url: https://play.google.com/store/apps/details?id=com.yintibao.funprint
    note: Official Google Play Store listing (com.yintibao.funprint).
  - kind: protocol-capture
    note: Protocol capture confirming Funny Print LX-D packet headers.
---

## Overview

**Fun Print** (also styled as *Funny Print*) is a widespread companion mobile app for 58 mm continuous thermal memo and sticker printers manufactured by Yintibao and various OEM rebranders.

The app icon features a playful white cat illustration over a bright coral-pink background.

## Protocol Characteristics

Printers driven by Fun Print speak the [funny-lx](funny-lx.html) protocol family:
- **Packet Framing**: Commands wrapped in multi-byte headers with row-by-row monochrome bitmap streaming.
- **Media**: 58 mm continuous receipt paper or continuous sticker rolls (384 dots print width).
