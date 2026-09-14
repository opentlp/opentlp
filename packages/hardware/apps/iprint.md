---
id: iprint
name: iPrint
developer: FrogToSea / iPrint Team
summary: Companion app for 58mm pocket printers, 15mm label printers, and A4 stencil/tattoo printers using the 51 78 Tiny protocol.
brand_color: "#2b7cad"
brand_palette:
  - "#2b7cad"
  - "#1c5f9b"
  - "#ffffff"
  - "#000000"
badge_letter: "I"
platforms:
  android:
    package: com.frogtosea.iprint
    url: https://play.google.com/store/apps/details?id=com.frogtosea.iprint
protocols:
  - tiny
replaces_apps:
  - iPrint
  - Tiny Print
popular_models:
  - GB01
  - GT08
  - JXM800
  - X8
  - GW08
  - C9
  - C15
is_multi_device: false
status: verified
sources:
  - kind: user-report
    url: https://play.google.com/store/apps/details?id=com.frogtosea.iprint
    note: Official Google Play Store listing by FrogToSea.
  - kind: protocol-capture
    note: Reverse-engineered APK communication flow, CRC8 polynomial 0x07 framing, and model matrix.
---

## Overview

**iPrint** (developed by **FrogToSea**) is the primary OEM backend application powering over 190 commercial thermal printer variants spanning 58mm mini pocket notes, 15mm tape labels, and 216mm (A4) stencil/tattoo printers.

## Protocol & Wire Format

- **Framing**: `0x51 0x78 <cmd> 0x00 <lenLow> <lenHigh> <payload> <crc8> 0xFF`
- **CRC8**: Polynomial `0x07`, initial value `0x00`.
- **Transports**: BLE (`0000ae00`, `0000ae30`, `0000ff00`, `0000ab00`), Bluetooth Classic SPP (`00001101`), and internal POS SoC UART.
