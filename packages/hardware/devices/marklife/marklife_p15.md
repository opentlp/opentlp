---
id: marklife_p15
brand: Marklife
model: P15

protocol:
  family: marklife
  packet_prefix: "10 ff"
  app: Marklife
  vendor_app: com.feioou.deliprint.yxq

print:
  width_dots: 96
  width_mm: 12
  dpi: 203
  colour: monochrome
  colour_planes: 1
  max_density: 15
  speed_mode: false

connectivity:
  ble:
    service_uuid: 0000ff00-0000-1000-8000-00805f9b34fb
    write_uuid: 0000ff02-0000-1000-8000-00805f9b34fb
    name_pattern: "P15"
    name_examples: [P15, P15_..._BLE]

reports: [battery, faults, device-name, serial-number, firmware-version, hardware-version]

status: verified

sources:
  - kind: user-report
    note: Driven using the legacy L11 ESC/POS protocol path.
  - kind: vendor-doc
    title: Marklife Android app decompilation (com.feioou.deliprint.yxq)
    note: Confirmed protocolType = 0 (L11 command path) in P15.java and DeviceManager.java.

---

15 mm label maker manufactured by Shenzhen Yinxiaoqian Technology Co., Ltd.
Sold under the Marklife brand and companion to the official Marklife app.

## Protocol notes

Unlike the P12 which uses modern `1F` job framing (`protocolType = 4`), the P15 firmware
speaks the manufacturer's legacy "L11" command framing (`protocolType = 0` in the official APK).
Jobs are initiated with a 15-byte zero wake-up, `10 FF F1 02` enable, an uncompressed `GS v 0`
raster, `1D 0C` gap positioning (or `1B 4A` continuous feed), and closed with `10 FF F1 45`.
Device info and battery queries use the `10 FF` command family over the ISSC service.
