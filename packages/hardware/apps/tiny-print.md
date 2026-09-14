---
id: tiny-print
name: Tiny Print
developer: Tiny Print / iPrint Team
summary: Ubiquitous 58mm cat and teddy bear continuous thermal pocket printers (0x51/0x78 Tiny protocol).
brand_color: "#5cc4f8"
brand_palette:
  - "#ffffff"
  - "#5cc4f8"
  - "#7870e0"
badge_letter: "T"
platforms:
  android:
    package: com.frogtosea.tinyPrint
    url: https://play.google.com/store/apps/details?id=com.frogtosea.tinyPrint
  ios:
    id: 1585952175
    url: https://apps.apple.com/app/tiny-print/id1585952175
protocols:
  - tiny
replaces_apps:
  - Tiny Print
  - iPrint
popular_models:
  - GB01
  - MX05
  - MX06
  - MX08
  - MX10
  - YT01
is_multi_device: false
status: verified
sources:
  - kind: user-report
    url: https://play.google.com/store/apps/details?id=com.frogtosea.tinyPrint
    note: Official Google Play Store listing by FrogToSea.
  - kind: user-report
    url: https://apps.apple.com/app/tiny-print/id1585952175
    note: Official Apple App Store listing.
  - kind: protocol-capture
    note: Verified 0x51 0x78 packet framing against GB01 cat printer.
---

## Overview

**Tiny Print** (and its sister app *iPrint*) is the companion app for hundreds of low-cost Chinese 58 mm continuous thermal pocket printers shaped as cats, teddy bears, and minimalist cameras.

The application icon displays a stylized pastel cat face with purple ears on a white background.

## Protocol Characteristics

Hardware driven by Tiny Print speaks the ubiquitous [tiny](tiny.html) protocol:
- **Packet Prefix**: `51 78`
- **Framing**: Fixed command header `0x51 0x78`, command byte, payload length, data payload, CRC-8 checksum, terminating byte `0xFF`.
- **Media**: 58 mm continuous thermal receipt rolls (384 printable dots at 203 DPI).
