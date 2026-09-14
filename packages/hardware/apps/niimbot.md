---
id: niimbot
name: NIIMBOT
developer: Wuhan Jingchen Intelligent Identification
summary: Smart thermal label makers using smart RFID/die-cut labels and Niimbot protocol.
brand_color: "#fc4840"
brand_palette:
  - "#ffffff"
  - "#fc4840"
  - "#b6b6b6"
badge_letter: "N"
platforms:
  android:
    package: com.gengcon.android.jccloudprinter
    url: https://play.google.com/store/apps/details?id=com.gengcon.android.jccloudprinter
  ios:
    id: 1359104615
    url: https://apps.apple.com/app/niimbot/id1359104615
protocols:
  - niimbot
replaces_apps:
  - NIIMBOT
popular_models:
  - D11
  - D110
  - B21
  - B1
  - D101
  - B3S
is_multi_device: false
status: verified
sources:
  - kind: user-report
    url: https://apps.apple.com/app/niimbot/id1359104615
    note: Official Apple App Store listing by Wuhan Jingchen Intelligent Identification Technology Co., Ltd.
  - kind: user-report
    url: https://play.google.com/store/apps/details?id=com.gengcon.android.jccloudprinter
    note: Official Google Play Store listing (JC Cloud Printer).
  - kind: protocol-capture
    note: Packet captures on D11 and B21 models validating Niimbot packet framing and RFID interrogation.
---

## Overview

**NIIMBOT** is the official cloud-enabled mobile printing suite created by **Wuhan Jingchen Intelligent Identification Technology Co., Ltd.** for their popular D-series and B-series portable label makers.

The official app icon features the distinctive red folded ribbon "N" emblem on a clean white background with silver accents.

## Protocol & RFID Capabilities

NIIMBOT printers operate using the proprietary [niimbot](niimbot.html) protocol:
- **Packet Prefix**: `55 55`
- **Framing**: `0x55 0x55`, type/command, data length, payload, checksum, end bytes `0xAA 0xAA`.
- **RFID Auto-Detection**: Many NIIMBOT printers (such as D11 and B21) contain near-field RFID readers in the paper bay that query roll metadata (dimensions, gap spacing, remaining labels) and transmit it to the companion app.
