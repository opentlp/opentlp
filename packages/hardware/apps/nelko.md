---
id: nelko
name: Nelko
developer: Nelko
summary: Companion app for Nelko's Bluetooth Classic TSPL2 label printers, including the 96-dot P21.
brand_color: "#1f6feb"
brand_palette:
  - "#1f6feb"
  - "#ffffff"
  - "#0d2b5c"
badge_letter: "N"
platforms:
  android:
    url: https://play.google.com/store/search?q=Nelko%20label%20printer&c=apps
  ios:
    url: https://apps.apple.com/search?term=Nelko%20label%20printer
protocols:
  - nelko-p21
replaces_apps:
  - Nelko
popular_models:
  - P21
is_multi_device: false
status: unverified
sources:
  - kind: oss-project
    url: https://github.com/merlinschumacher/nelko-p21-print
    licence: AGPL-3.0
    note: >-
      Bluetooth capture of the official app's traffic against the Nelko P21,
      establishing the SPP transport, TSPL2 job order and proprietary
      BATTERY?/CONFIG? queries the app uses. AGPL-3.0 code is not
      redistributed; only protocol facts were used.
  - kind: user-report
    url: https://github.com/TylerCode/Fyne-P21-Print
    note: >-
      Cross-platform reimplementation confirms the P21 pairs as a Bluetooth
      Classic SPP device and that the official Nelko app drives it over the
      captured TSPL2 subset.
---

## Overview

**Nelko** is the companion mobile application shipped with Nelko's Bluetooth
label printers, most prominently the **P21**. The printer communicates over a
Bluetooth Classic SPP / RFCOMM serial channel using a TSPL2-derived command
subset, and the app reads an NFC tag on each label roll to identify the
consumable — a mechanism that doubles as soft DRM against third-party stock.

## Protocol characteristics

- **Transport**: Bluetooth Classic SPP / RFCOMM at 115200 baud, 8N1. No GATT
  service is advertised, so Web Bluetooth cannot connect.
- **Commands**: a TSPL2 subset (`SIZE`, `GAP`, `DIRECTION`, `DENSITY`, `CLS`,
  `BITMAP`, `PRINT`) preceded by an `\x1b!o` cancel-pause preamble.
- **Raster**: 96-dot, 12-byte MSB-first rows, 1-is-black polarity.
- **Extensions**: proprietary `BATTERY?` and `CONFIG?` queries over the same
  serial channel.
