---
id: munbyn-print
name: Munbyn Print
developer: MUNBYN / SYZ
summary: Commercial shipping and thermal barcode label printers using TSPL/CPCL protocol.
brand_color: "#ff4713"
brand_palette:
  - "#ffffff"
  - "#ff4713"
badge_letter: "M"
platforms:
  android:
    package: com.syz.mprint
    url: https://play.google.com/store/apps/details?id=com.syz.mprint
  ios:
    id: 1629319392
    url: https://apps.apple.com/app/munbyn-print/id1629319392
protocols:
  - tspl
replaces_apps:
  - Munbyn Print
  - Munbyn
popular_models:
  - ITPP941
  - RW401AP
  - Realwriter 941
  - ITPP130
is_multi_device: false
status: verified
sources:
  - kind: user-report
    url: https://apps.apple.com/app/munbyn-print/id1629319392
    note: Official Apple App Store listing by MUNBYN / SYZ.
  - kind: user-report
    url: https://play.google.com/store/apps/details?id=com.syz.mprint
    note: Official Google Play Store listing.
  - kind: protocol-capture
    note: Verified TSPL protocol framing across USB and Bluetooth for ITPP941 and Realwriter models.
---

## Overview

**Munbyn Print** is the mobile application suite provided by **MUNBYN** for their commercial thermal shipping label printers (ITPP941, Realwriter 941, RW401AP) widely used across e-commerce logistics and warehouse shipping.

The app icon features the distinctive Munbyn bright orange emblem on a pure white background.

## Protocol Characteristics

Munbyn desktop and wireless shipping printers communicate using the TSPL protocol ([tspl](tspl.html)):
- **Transports**: USB, BLE, and Wi-Fi.
- **Media**: Standard 4×6 inch commercial waybills and die-cut barcode rolls.
