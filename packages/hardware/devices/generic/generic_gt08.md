---
id: generic_gt08
brand: Generic Cat Printer
model: GT08

protocol:
  family: tiny
  variant: standard
  packet_prefix: "51 78"
  app: iPrint
  vendor_app: com.frogtosea.iprint
  replaces_apps:
    - Tiny Print

print:
  width_dots: 1728
  width_mm: 216
  media_width_mm: 216
  dpi: 203
  colour: monochrome

connectivity:
  ble:
    service_uuid: 0000ae30-0000-1000-8000-00805f9b34fb
    write_uuid: 0000ae01-0000-1000-8000-00805f9b34fb
    notify_uuid: 0000ae02-0000-1000-8000-00805f9b34fb
    name_pattern: "GT08"

status: unverified

sources:
  - kind: vendor-doc
    url: https://play.google.com/store/apps/details?id=com.frogtosea.iprint
    note: >-
      Decompiled APK PrintModelUtils.java confirms GT08 is an A4 thermal document/tattoo printer with 1728 paper dots and 1600 print dots at 203 DPI.
---

Part of the [tiny family](tiny.html). Verified from `com.frogtosea.iprint` (`PrintModelUtils.java`)
as an A4-format portable thermal document/tattoo printer (1728 paper dots, 1600 printhead dots).
