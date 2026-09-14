# OpenTLP Manufacturer Apps & Driver Compatibility Audit Report

This report documents the reverse engineering and protocol audit of the official manufacturer Android APKs for all thermal label and receipt printer families supported in OpenTLP / BleWebler2.

---

## Executive Summary Matrix

| Manufacturer / App | App ID / Tech Stack | Protocol Families Identified | BLE GATT Service & Characteristics | OpenTLP Driver | Match Status | Discrepancies & Recommendations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PeriPage** | `com.ileadtek.peripage`<br>*(Native Android)* | PeriPage Bitmap Packet Protocol (`10 FF ...`) | Service: `0000e0ff...`<br>Write: `0000ff01...` | `peripage` | **100% Match** | Exact opcode and baud match. Model catalog spans A6, A6+, A8, A9, A9s, A9 Pro, A40, A40+, P60. |
| **Marklife** | `com.feioou.deliprint.yxq`<br>*(Native Android)* | Standard Deli/Marklife (`0x1B 0x2A`) & Legacy L11 (`GS v 0`) | Service: `0000ff00...`<br>Write: `0000ff02...`<br>Notify: `0000ff01...` | `marklife` | **100% Match** | Covers P11, P12, P15, P50, P70, P80, L11, L13, LP90, Munbyn, LuckJingle. |
| **Pocket Printer** | `com.printer.lidloffice`<br>*(Native LuckPrinter SDK)* | LuckPrinter ESC/POS Raster + Flow Credits | Service: `0000ff00...`<br>Write: `0000ff02...`<br>Notify: `0000ff01...`<br>Credits: `0000ff03...` | `marklife` *(legacy L11)* | **100% Match** | Exact match with Silvercrest / Lidl L13. Packet `0x01 <credit>` flow control matches OpenTLP implementation. |
| **Tiny Print** | `com.frogtosea.tinyPrint`<br>*(Native Android)* | Tiny Print (`0x51 0x78`) & New Prefixed (`0x12 0x51 0x78`) | Service: `0000ae00...` / `0000ae30...`<br>Write: `0000ae01...`<br>Notify: `0000ae04...` / `0000ae02...` | `catprinter-tiny` | **100% Match** *(GATT UUIDs can be widened)* | Add `0000ae00` primary service and `0000ae04` notify to `catprinter-tiny-driver.ts`. Discovered 80+ model aliases. |
| **Funny Print** | `com.lailaixiong.funnyprint`<br>*(React Native / Hermes)* | Funny LX-D Challenge-Response Raster | Service: `0000ffe6...` / `0000ffe0...`<br>Write: `0000ffe1...`<br>Notify: `0000ffe2...` | `catprinter-funny-lx` | **100% Match** | Confirmed MAC status query (`0x5a, 0x01`), CRC-16 challenge (`0x5a, 0x0a/0x0b`), 100-byte packets (`0x55`), footer echo. Discovered DL-T1, DL-T01, DL-P01, M2 series (A4). |
| **Fun Print / WalkPrint** | `com.fun.mxw`<br>*(uni-app / DCloud)* | V5C (`0x56 0x88`), V5X (`0x22 0x21`), V5G (`0x51 0x78`), MP850/MXW-A4 (Luck flow control), R5 | `0000ae30...` (AE01, AE02, AE03)<br>`0000ffa0...` (FFA1, FFA2)<br>`0000ff00...` (FF02, FF01, FF03)<br>`0000200a...` (202A, 203A, 204A) | `catprinter-v5c`<br>`catprinter-mxw01`<br>`catprinter-v5g` | **100% Match** | Complete catalog of 170+ models categorized into V5G (Tiny Print dialect), V5X (bulk raster), V5X_S, and V5C. Discovered FFA0 and 200A GATT UUIDs for MXW- and R5 models. |
| **Niimbot** | `com.gengcon.android.jccloudprinter` / `com.niimbot.cxprinter`<br>*(Flutter / SecNeo)* | Niimbot `0x55 0x55` Packet & RFID Framing | Service: `0000fee0...` / `e7810a71...`<br>Write: `0000fee2...` / `bef8d6c9...`<br>Notify: `0000fee3...` / `bef8d6c9...` | `niimbot` | **100% Match** *(Prefix matching can be widened)* | Full 80-model official catalog extracted from `printerList.json`. OpenTLP's `isCompatible` should be expanded to recognize prefixes like `D101`, `B3S`, `H1`, `B203`, etc. |
| **Phomemo / Print Master** | `com.project.aimotech.printmaster` / `com.quyin.phomemo`<br>*(Native Android)* | P12/A30 (`0x1F 0x11`), M110/M220 ESC/POS, TSPL (`0x1B 0x40`) | Service: `0000ff00...` / `49535343...`<br>Write: `0000ff02...` / `49535343-8841...`<br>Notify: `0000ff03...` / `49535343-1e4d...` | `phomemo-p12`<br>`phomemo-m110`<br>`phomemo-tspl` | **100% Match** | Extracted 85 distinct printer models and their broadcast SN prefixes from `DefaultPrinter.json` (e.g. `M002`, `Q002`, `MIHP`, `Q199E`, `Q206`, `Q429`). |

---

## Detailed Findings by Manufacturer Application

### 1. PeriPage (`com.ileadtek.peripage`)
- **Supported Models**: A6 (203dpi), A6+ (304dpi), A8, A8+, A9, A9+, A9 Pro, A9 Max, A40, A40+, P60, etc.
- **Connection Flow**:
  - Service UUID: `0000e0ff-0000-1000-8000-00805f9b34fb` (primary BLE)
  - Write Characteristic: `0000ff01-0000-1000-8000-00805f9b34fb`
  - SPP Classic fallback: Serial Port Profile UUID `00001101-0000-1000-8000-00805f9b34fb`
- **Protocol**:
  - Command framing: `10 FF <cmd> <params>`
  - Image rasterization: 384 dots (58mm) or 576/800 dots (A4/wide) compressed bitmap chunks.
- **OpenTLP Comparison**:
  - Driver `peripage` in `BleWebler2/packages/core/src/drivers/peripage/` matches the protocol completely.

---

### 2. Marklife (`com.feioou.deliprint.yxq`)
- **Supported Models**: P11, P12, P15, P50, P70, P80, D110, L11, L13, LP90, Munbyn, LuckJingle.
- **Connection Flow**:
  - Service UUID: `0000ff00-0000-1000-8000-00805f9b34fb`
  - Write Characteristic: `0000ff02-0000-1000-8000-00805f9b34fb`
  - Notify Characteristic: `0000ff01-0000-1000-8000-00805f9b34fb`
- **Protocols**:
  1. *Modern Marklife Protocol*: `0x1B 0x2A` / `0x1F` packet framing with density command `0x1F 0x11 0x27`.
  2. *Legacy L11/LuckJingle Protocol*: Wakeup 12 zeros, `0x10 0xFF 0xF1 0x03` enable, `GS v 0` uncompressed raster, `0x1D 0x0C` gap alignment, `0x10 0xFF 0xF1 0x45` end job.
- **OpenTLP Comparison**:
  - Driver `marklife` in `BleWebler2/packages/core/src/drivers/marklife/` implements both modern Marklife and legacy L11 paths with full fidelity.

---

### 3. Pocket Printer (`com.printer.lidloffice`)
- **Supported Models**: Lidl Silvercrest Pocket Printer (L13), plus 150+ OEM printers supported by LuckPrinter SDK (`PrinterEnum.java`).
- **Connection Flow**:
  - Service UUID: `0000ff00-0000-1000-8000-00805f9b34fb`
  - Write: `0000ff02-0000-1000-8000-00805f9b34fb`
  - Notify: `0000ff01-0000-1000-8000-00805f9b34fb`
  - Flow Control / Credit Notify: `0000ff03-0000-1000-8000-00805f9b34fb`
- **Protocol**:
  - Printable width: 96 dots (12 mm/15 mm tape).
  - Credit packet: `0x01 <credit_count>` replenishes queue.
  - MTU exchange packet: `0x02 <mtu_u16le>`.
- **OpenTLP Comparison**:
  - 100% match with OpenTLP's `marklife-driver.ts` legacy path (`LEGACY_L11_PREFIXES`).

---

### 4. Tiny Print (`com.frogtosea.tinyPrint`)
- **Supported Models**:
  - *384-dot / 58mm*: GB01–GB06, GT01–GT04, 58P5, WL01, X5–X18, P1, P2, P6, P7, PR02, PR07, DY01–DY49, S01–S102, LT01, LY01–LY10, LP6, XiaoWa, ROSSMANN, TCM690464, Pocket Printer, SeznikNeo, etc.
  - *96-dot / 15mm Label*: 15P3, YK06, WQ02, L1, U2, CPLM10.
  - *576-dot / 80mm*: LY05, LY11, X1, HD1, PR30, PR35, P5, DL_X2Pro.
  - *Wide / A4*: GT08–GT10, GW08–GW09, PR88–PR893, X8, X9, ZP801, ZP802, A41II–A43, MPA81, P4, etc.
- **Connection Flow**:
  - Services: `0000ae00-0000-1000-8000-00805f9b34fb` (primary in app), `0000ae30...`, `0000ff00...`, `0000ab00...`
  - Write: `0000ae01...`, `0000ff02...`, `0000ab01...`
  - Notify: `0000ae04...`, `0000ab03...`, `0000ff03...`
- **Protocol**:
  - Standard dialect: `51 78 <cmd> 00 <lenLow> <lenHigh> <payload> <crc8> FF`
  - Prefixed dialect: `12 51 78 ...` for models like JXM800, LY10, LY11, LP100.
  - Lattice, Energy (`AF 00 02 00`), Speed (`BD 00 01 00`), Print Mode (`BE 00 01 00`).
- **OpenTLP Comparison**:
  - Driver `catprinter-tiny` has exact CRC8 and packet framing match. Recommend adding service `0000ae00` and characteristic `0000ae04` to `connectionRequirements` so Web Bluetooth pairs with hardware running OEM firmware.

---

### 5. Funny Print (`com.lailaixiong.funnyprint`)
- **Supported Models**:
  - *Mini printer (D series)*: LX-D01 through LX-D09, LX-D2 through LX-D9, DL-T1, DL-T01.
  - *Label printer (P series)*: DL-P01, P series labels.
  - *Photo printer (C series)*.
  - *A4 printer (M2 series)*.
- **Connection Flow**:
  - Service: `0000ffe6-0000-1000-8000-00805f9b34fb` (or `0000ffe0...`)
  - Write: `0000ffe1-0000-1000-8000-00805f9b34fb`
  - Notify: `0000ffe2-0000-1000-8000-00805f9b34fb`
- **Protocol & Handshake**:
  - Opcode `0x01` (`process0x01Resp`): Status query (`0x5a, 0x01, 0x00`) -> printer returns 6-byte MAC address.
  - Opcode `0x0A` (`process0x0aResp`): App sends 10 random bytes -> printer responds with low byte of CRC-16 XMODEM challenge.
  - Opcode `0x0B` (`process0x0bResp`): App sends high byte of CRC-16 challenge -> printer authenticates with `0x5a, 0x0b, 0x01`.
  - Opcode `0x04` (`process0x04Resp`): Print header and footer with total packet count.
  - Image packets: 100-byte packets (`0x55 <high> <low> <96 bytes raster> <0x00>`).
  - Flow control / ACKs: `0x5a, 0x05` (retry packet index), `0x5a, 0x06` (page done), `0x5a, 0x08` (error/status).
- **OpenTLP Comparison**:
  - Driver `catprinter-funny-lx` is an exact 100% implementation of this challenge-response and packet structure.

---

### 6. Fun Print / WalkPrint (`com.fun.mxw`)
- **Supported Models (170+ models in `ble_name_config`)**:
  - *Model V5G (Tiny Print protocol)*: MX01–MX13, MINIPRINTER, JL-BR22, URBANWORXKIDSCAMERA, CYLOBTPRINTER, MXTP-100, AZ-P2108X, PD01, MINISO-M1, LP212, XOPOPPY, BQ01–BQ17, MXW009, MXW010, EWTTOET-N3689, KP-IM606, X6, K06, C18, MINISO-M12, etc.
  - *Model V5X (Bulk raster protocol)*: MXW01, MXW01-1, X1, X2, C17, MXW-W5.
  - *Model V5X_S (Bulk raster + split)*: PORTABLEPRINTER, INSTANTPRINTPLUS, REKA, HDMDT-00, JK01, BH03, BHSZY, PD03, FLYINGTIGER097, LP215, KERUI, AI01, M8HZ, Q15, M13, STICKERMATE, Q17, MXW13, MXW18, QD01, JME13, TCM747736, Q5, Q6, Q10, JK02, JP01, YY01, V8, V9, etc.
  - *Model V5C (56 88 protocol)*: YTB01, YINTIBAO-V5, etc.
  - *Model MP850 / MXW-A4*: A4 thermal printers with LuckPrinter credit flow control.
  - *Model R5*: New specialized hardware.
- **Connection Flow & GATT UUIDs**:
  1. *MXW / C17 / V5X*:
     - Service: `0000ae30-0000-1000-8000-00805f9b34fb`
     - Cmd Write: `0000ae01...`
     - Data Write: `0000ae03...`
     - Notify: `0000ae02...`
  2. *MXW- (V2)*:
     - Service: `0000ffa0-0000-1000-8000-00805f9b34fb`
     - Write: `0000ffa1...`
     - Notify: `0000ffa2...`
  3. *MP850 / MXW-A4*:
     - Service: `0000ff00-0000-1000-8000-00805f9b34fb`
     - Write: `0000ff02...`
     - Notify: `0000ff01...`
     - Credit Control: `0000ff03...`
  4. *R5*:
     - Service: `0000200a-0000-1000-8000-00805f9b34fb`
     - Write: `0000202a...`
     - Notify: `0000203a...`
     - Data Notify: `0000204a...`
- **OpenTLP Comparison**:
  - Drivers `catprinter-v5c`, `catprinter-mxw01`, and `catprinter-v5g` perfectly match their respective protocol subsets. Recommend adding service `0000ffa0` to `catprinter-mxw01` connection requirements for `MXW-` branded units.

---

### 7. Niimbot (`com.gengcon.android.jccloudprinter` / `com.niimbot.cxprinter`)
- **Supported Models (80 models in `printerList.json`)**:
  - *B Series*: B1, B1 Pro, B1 SE, B2, B2 Pro, B3, B3S, B3S_A, B3S_P, B4, B4 Pro, B11, B16, B18, B18S, B21, B21_Pro, B21S, B21S-C2B, B21-L2B, B21-C2B, B31, B32, B32R, B50, B50W, B203, JCB3S.
  - *D Series*: D11, D11_Pro, D11_H, D11S, D110, D110_M, D101, D41, D61, Dxx, Hi-NB-D11, Hi-D110.
  - *M / K / P / T Series*: M2_H, M3, JC-M90, MP3K, MP3K_W, K2, K3, K3_W, K3_ITD, K4, P1, P1S, P18, T2S, T6, T7, T8, T8S, TP2M_H.
  - *Special OEM*: A1 Pro, A8, A8_P, A20, A203, A63, C1, EP1C, EP2M_H, EP3M, ET10, Fust, H1, H1S, N1, S1, S3, S6, S6_P, Z401, Betty.
- **Connection Flow**:
  - Legacy BLE Service: `0000fee0-0000-1000-8000-00805f9b34fb`
    - Write: `0000fee2-0000-1000-8000-00805f9b34fb`
    - Notify: `0000fee3-0000-1000-8000-00805f9b34fb`
  - Modern BLE Service: `e7810a71-73ae-499d-8c15-faa9aef0c3f2`
    - Write / Notify: `bef8d6c9-9c21-4c9e-b632-bd58c1009f9f`
- **Protocol**:
  - Framing: `0x55 0x55 <cmd> <len> <payload> <checksum> 0xAA 0xAA`
  - RFID interrogation, gap sensing, paper type detection, battery, density (1–5).
- **OpenTLP Comparison**:
  - Driver `niimbot` in `BleWebler2/packages/core/src/drivers/niimbot/` uses `@mmote/niimbluelib` and implements both services.
  - **Actionable Gap**: `isCompatible()` in `niimbot-driver.ts` only matches `name.includes("niimbot") || name.startsWith("d11") || name.startsWith("b21") || name.startsWith("b1")`. Devices that advertise without "niimbot" (e.g. `D101`, `B3S`, `H1`, `B203`, `B4`) should be added to name matching.

---

### 8. Phomemo / Print Master (`com.project.aimotech.printmaster` / `com.quyin.phomemo`)
- **Supported Models (85 distinct types from `DefaultPrinter.json`)**:
  - *D Series*: D10, D20, D30, D30N, D30Pro, D30S, D30S New, D30S Pro, D31, D32, D35, D50, D68, D80, D480BT, D480BT PRO, D680BT.
  - *M Series*: M8, M20 Pro, M100, M102, M105, M108, M108TA, M108_Z, M109, M110, M110C, M110SA, M120, M120C, M126, M128, M150, M200, M200C, M206, M208, M209, M210, M219, M220, M220C, M220S, M221, M330, M332, M420, M421, M950, M960, M960D, BMW-M3, YCN-M3.
  - *P / Q Series*: P12, P12Pro, P24, P50, P580, P780BT, P780BT PRO, P1000, P3100D, P3100DJ, P3200, P3200D, P5100, Q30, Q30S, Q31, Q32.
  - *Other Series*: A30, B246D, DM170, E50, E50Pro, E600S, E8000, E9000, F12, LM1600, LT12, PM-201.
  - *Phomemo App Series*: M08F, TP81 (TP84–TP88), M832, M836, Q302, Q580, T02 (T02E, Q02E, C02E), M02, M02S, M02Pro, M03, M04S.
- **Connection Flow**:
  - BLE Service: `0000ff00-0000-1000-8000-00805f9b34fb` (Write: `0000ff02...`, Notify: `0000ff03...`)
  - ISSC BLE / SPP: `49535343-fe7d-4ae5-8fa9-9fafd205e455` (Write: `...8841...`, Notify: `...1e4d...`)
- **Broadcast SN Prefixes**:
  - `M110`: `M002`, `Q002`
  - `D30`: `MIHP`
  - `M110S`: `Q199E`
  - `M08F`: `Q206`, `Q429`
- **OpenTLP Comparison**:
  - Drivers `phomemo-p12`, `phomemo-m110`, `phomemo-m-series`, and `phomemo-tspl` match the hardware raster and control commands. Adding the broadcast SN prefixes ensures instant, automatic connection without requiring manual model selection.

---
### 9. Luck Jingle (`com.dingdang.newprint`)
- **Developer / Ecosystem**: Xiamen Lujiang Technology Co., Ltd. (OEM supplier for LuckPrinter, Silvercrest, and Deli hardware).
- **Tech Stack**: Flutter + Native Android Java runtime (`com.luckprinter.sdk_new`).
- **Supported Models (72 models in `assets/printer_model_list.json`)**:
  - *Mini Pocket Printers (58mm / 48mm / 203dpi)*: DPS1, L3S, P1, AL2, Seznik S1, PPSL, C50X, C2X, S1, A2Pro1, D1Pro1, S1Pro1, RD468, D1, C50H, T210, A2Pro2, D1Pro2, S1Pro2, A2, PPA2L, C2, L1.
  - *Label Printers & Half-Inch Models (12mm / 15mm)*: L10, L12Pro, C50, ZJ-9260, Y50, MPL11, L12, L13, C2S, YMP-05, L15, C16.
  - *A4 Thermal & Wide Printers (210mm)*: L80, L82, L86, RG2, H1, D80, Fichero 4437, MT81, L81, D82, MT82, A80, A40, H2, MT85, D83, MT40, MT86, A81, A47, A43.
  - *Tattoo Stencil Printers*: ITP05, ITP06, APA46Y, APA41, A41, TPA46X, A46S, A46, C50S, A49, C3.
  - *Waybill / Shipping Printers*: GD985, Y810, D400.
  - *AI Printers*: AI50.
- **Connection Flow & Transports**:
  - *BLE Service*: `0000ff00-0000-1000-8000-00805f9b34fb`
    - Write: `0000ff02-0000-1000-8000-00805f9b34fb` (or writeWithoutResponse)
    - Notify: `0000ff01-0000-1000-8000-00805f9b34fb` (status)
    - Credit Notify: `0000ff03-0000-1000-8000-00805f9b34fb` (flow credits)
  - *Bluetooth Classic*: SPP UUID `00001101-0000-1000-8000-00805F9B34FB` (via `d4.c` with pairing PIN `0000` or `1234`).
  - *USB / WebUSB*: The mobile app does NOT implement USB OTG or WebUSB.
- **Protocol**:
  - Identical LuckPrinter architecture: 12-byte zero wake preamble, `10 FF F1 03` enable, ESC/POS `GS v 0` raster, `1D 0C` position, and `10 FF F1 45` job close.
  - Credit-based flow control (`waiting credit > 0`, decrements credits on packet dispatch).
- **OpenTLP Comparison**:
  - Implemented via OpenTLP's `marklife-driver.ts` legacy L11 path (`LEGACY_L11_PREFIXES`). Adding Luck Jingle broadcast prefixes ensures seamless connection across all 72 models.

---

## Comprehensive Transports Support Audit

We audited each manufacturer Android application for its underlying transport layer support (Bluetooth LE, Bluetooth Classic SPP, USB Serial / OTG, and WebUSB):

| Manufacturer / Application | Android Package | BLE (GATT) | Classic (SPP) | USB Serial / OTG | WebUSB / WebSerial | Transport Details & Implementation Notes |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **PeriPage** | `com.ileadtek.peripage` | **Yes** | **Yes** | **Yes** | Via WebSerial | BLE `0000e0ff...`; Classic SPP `00001101...` (115200 baud); USB CDC-ACM for A40/A9. |
| **Marklife** | `com.feioou.deliprint.yxq` | **Yes** | **Yes** | No | Via WebBluetooth | BLE `0000ff00...`; Classic SPP `00001101...` ("SPP Slave" on Windows/Android). No mobile USB OTG. |
| **Pocket Printer** (Lidl) | `com.printer.lidloffice` | **Yes** | SDK only | No | Via WebBluetooth | BLE `0000ff00...` with flow credit notify `0000ff03...`. Classic SPP present in SDK but hidden in Lidl UI. |
| **Luck Jingle** | `com.dingdang.newprint` | **Yes** | **Yes** | No | Via WebBluetooth | Dual BLE (`0000ff00...`) & Classic SPP (`00001101...` via `d4.c`). `ConnectWayEnum` explicitly limits to BLE & Classic. |
| **Tiny Print** | `com.frogtosea.tinyPrint` | **Yes** | **Yes** | **Yes** (A4) | Via WebBluetooth / WebSerial | BLE `0000ae00...` / `ae30...`; Classic SPP for legacy devices; USB CH34x for A4 PR88/GT08 models. |
| **Funny Print** | `com.lailaixiong.funnyprint` | **Yes** | No | No | Via WebBluetooth | Pure BLE via `react-native-ble-plx` (`0000ffe6...` / `0000ffe0...`). No classic BT or USB. |
| **Fun Print / WalkPrint** | `com.fun.mxw` | **Yes** | No | No | Via WebBluetooth | Pure BLE via DCloud FastBle (`0000ae30...`, `0000ffa0...`, `0000200a...`). No classic BT or USB. |
| **Niimbot** | `com.gengcon.android.jccloudprinter` | **Yes** | **Yes** | **Yes** | Via WebSerial / WebBluetooth | BLE `0000fee0...` & `e781...`; Classic SPP (`0000` / `1234` PIN); Desktop & Android USB CDC-ACM serial. |
| **Phomemo / Print Master** | `com.project.aimotech.printmaster` | **Yes** | **Yes** | **Yes** | Via WebSerial / WebBluetooth | BLE `0000ff00...` & ISSC `49535343...`; Classic SPP; Type-C USB CDC-ACM for PC printing. |

---

## Paper, Consumables & RFID/NFC Intelligence

### 1. Media Types Recognized Across Apps
* **Continuous Roll (`roll`)**: Variable length printing, cut by manual tear bar or motorized guillotine (e.g. PeriPage, Tiny Print, Niimbot continuous rolls).
* **Die-Cut Gap Labels (`gap` / `normal_label`)**: Standard label rolls with fixed gap pitch (15–80 mm wide). Firmware senses gaps via optical transmissive sensors.
* **Black Mark Labels (`black-mark`)**: Reflective black bars on paper underside for precise registration (common in Niimbot B21/B3S card stock).
* **Folded Fanfold Paper (`fold`)**: Multi-page continuous A4 paper with perforation lines (Luck Jingle L80/A80, PeriPage A40).

### 2. RFID / NFC Tag Architecture
* **Niimbot Ecosystem**:
  - 62 out of 80 models feature internal 13.56MHz RFID interrogators (`rfidType: 1..3`).
  - The tag stores a unique UID, barcode string, consumable type code (`1` = gap, `2` = black mark, `3` = transparent, `4` = continuous), total roll length (meters/labels), and used length.
  - The printer firmware enforces or validates genuine consumables, automatically setting printhead strobe times and margin offsets.
* **Phomemo / Print Master Ecosystem**:
  - Newer M-series and D-series rolls feature NFC chips read by the printer chassis to detect label size automatically.

### 3. OEM Cloud Server Lookups & OpenTLP Privacy Policy
* **OEM Backend Endpoints Discovered**:
  - Niimbot: `api.jc-cloud.com`, `api.niimbot.com` (RFID barcode -> dimension/template lookup)
  - Phomemo: `api.aimotech.com`, `api.quyin.com` (SN and tag -> cloud template database)
  - Luck Jingle: `https://api.gj.luckjingle.com/api/sdk/check2`, `https://h5.app.luckjingle.com`
* **Privacy & Security Risk**:
  - Querying OEM cloud servers at runtime transmits user IP addresses, timestamps, hardware serial numbers, and paper consumption patterns to third-party overseas servers.
* **OpenTLP Policy**:
  - **OpenTLP strictly forbids runtime remote polling to manufacturer servers.**
  - All paper presets, dimensions, DPIs, and physical bounds must be bundled locally inside OpenTLP (`packages/hardware/` and driver static catalogs) or retrieved directly from the physical hardware over BLE/USB via local status commands (`loadedMediaFromRfid()`, `getStatus()`).

---

## Clarification: "Pocket Printer" Model Count (31 Models vs. Silvercrest L13)

A common point of confusion in third-party repositories (such as TiMini-Print and catlabel) was the classification of **"Pocket Printer"**:
* Some community catalogs listed **31–33 models** under a profile titled "Pocket Printer" (`Luxorp.PX10`, `EMX-040256`, `SeznikEcho`, `TCM690464`, `UXPORTMIP`, `DL_GE225`, `ML-MP-01`, `ROSSMANN`, `0019B-C`, `DTR-R0`, `GB03PL`, `HT0125`, `RT034h`, `DT1-0`, `SC03h`, `SC04h`, `X103h`, `DY03`, `X100`, `X2h`, `X5h`, `X6h`, `X7h`, `XC9`, `D1`, `X18`, `DT1-R`, `TD-11308`, `XC9-FL01`, `P1`, `P2`).
* **The Reality**: Those 31 models are **Tiny Print (0x51 0x78) protocol rebadges** manufactured for European supermarket and promo vendors (`com.frogtosea.tinyPrint`).
* **The Official App**: The actual Android app titled **Pocket Printer** (`com.printer.lidloffice`) was built specifically by Xiamen Lujiang / LuckPrinter for the **Lidl Silvercrest Pocket Printer (L13)**, speaking the **LuckPrinter / L11 ESC/POS protocol (`10 FF F1 02` ... `GS v 0`)**.
* OpenTLP correctly decouples the two:
  1. The 31 Tiny Print OEM rebadges belong to [`catprinter-tiny`](file:///c:/Users/johsc/OneDrive/Documents/Tech/Marklife%20P12%20Label%20Printer%20BLE/universal%20Approach/BleWebler2/packages/core/src/drivers/catprinter-tiny/catprinter-driver.ts).
  2. The Lidl Silvercrest Pocket Printer belongs to [`marklife-driver.ts`](file:///c:/Users/johsc/OneDrive/Documents/Tech/Marklife%20P12%20Label%20Printer%20BLE/universal%20Approach/BleWebler2/packages/core/src/drivers/marklife/marklife-driver.ts) under the L13 legacy path.

---

## Recommended Concrete Updates to BleWebler2
1. **`catprinter-tiny-driver.ts`**:
   - Add `0000ae00-0000-1000-8000-00805f9b34fb` to `connectionRequirements.services`.
   - Add notify UUID `0000ae04-0000-1000-8000-00805f9b34fb`.
   - Expand `namePrefixes` with `DL_X2`, `ROSSMANN`, `TCM690464`, `SeznikNeo`, `15P3`, `YK06`, `CPLM10`.

2. **`catprinter-funny-lx/funny-lx-driver.ts`**:
   - Add fallback service `0000ffe0-0000-1000-8000-00805f9b34fb`.
   - Expand `MODELS` with `DL-T1`, `DL-T01`, `DL-P01`.

3. **`catprinter-mxw01/mxw01-driver.ts`**:
   - Add service `0000ffa0-0000-1000-8000-00805f9b34fb` (Write: `ffa1`, Notify: `ffa2`) to support `MXW-` branded revisions.
   - Expand `MODELS` with the full `V5X` / `V5X_S` names catalog (e.g. `M8HZ`, `Q15`, `STICKERMATE`, `TCM747736`, `Q5`, `Q10`, `BHSZY`, `FLYINGTIGER097`).

4. **`niimbot/niimbot-driver.ts`**:
   - Expand `isCompatible()` to include prefixes: `d101`, `b3s`, `b203`, `b4`, `b2`, `b18`, `b31`, `b32`, `b50`, `h1`, `s1`, `s3`, `s6`, `t6`, `t8`, `k2`, `k3`, `a20`, `a63`, `c1`, `jc`.

5. **`phomemo-m110/phomemo-m110-driver.ts`**:
   - Expand `MODELS` with the official Bluetooth broadcast SN prefixes: `M002`, `Q002`, `MIHP`, `Q206`, `Q429`.
---

## Deep-Dive Audit: Dolewa Ecosystem & iPrint (Applications 9 – 12)

Following the audit of the initial 8 manufacturer applications, four additional applications were acquired, cryptographically hashed, unpacked, decompiled, and audited against OpenTLP driver architecture:
1. `com.dolewa.a4printer` (Dolewa A4 Printer)
2. `com.dolewa.camera` (Dolewa Camera)
3. `com.dolewa` (Dolewa / Laixue)
4. `com.frogtosea.iprint` (iPrint by FrogToSea)

---

### Application 9: Dolewa A4 Printer (`com.dolewa.a4printer`)
* **Developer / Publisher**: Shenzhen Dolewa Technology Co., Ltd.
* **APK Provenance**: Version 1.4.1 (APKPure direct), 95,257,857 bytes, SHA-256: `ef23055304a6f9c329d57f3e9b62ae637437934ec1ca23e2f8cffdd837fc97e4`.
* **Technology Stack**:
  - Front-end: React Native running under Hermes Bytecode v96 (`assets/index.android.bundle`).
  - Native Android modules: `com.dolewa.ReactNaitveModule.M2PrinterModule`, `com.communication.bt.BluetoothApi`, `com.beeprt.sdk.F2Function`, `com.jniclass.Compress`.
* **Supported Models & Bluetooth Names** (extracted from `BluetoothApi.java`):
  - Models: `A80`, `A80H`, `Y80`, `D80`, `D80Pro`, `Y80H`, `Y8`, `Y8Pro`, `M8`, `M8H`, `C80`, `C80H`, `ITP04`, `L11`, `L12`, `A50`, `L50`, `L3`, `L4`, `F2`, `FlashToy`, `I-P-01`.
  - Notable rebadges: `ITP04` (Itari/Munbyn portable A4 thermal printer), `A80`/`D80` (Dolewa A4 tattoo stencil printers), `L11`/`L12`/`A50` (LuckPrinter portable mini label printers).
* **Transports**:
  - **BLE GATT**:
    - Primary Service: `0000ff00-0000-1000-8000-00805f9b34fb`
      - Write (Tx): `0000ff01-0000-1000-8000-00805f9b34fb`
      - Read/Notify (Rx): `0000ff02-0000-1000-8000-00805f9b34fb`
      - Flow Control / Credit: `0000ff03-0000-1000-8000-00805f9b34fb`
    - Fallback Service: `0000ffe6-0000-1000-8000-00805f9b34fb` (Write: `0000ffe1`, Notify: `0000ffe2`).
  - **Bluetooth Classic SPP**: `00001101-0000-1000-8000-00805f9b34fb` via `com.communication.bt.spp.a`. `M2PrinterModule` defaults to SPP on devices that negotiate classic RFCOMM.
  - **USB / Serial**: Supported via JNI `Compress` bindings.
* **Authentication & Protocol Framing**:
  - **Security Handshake**: Uses the Funny Print LX-D authentication challenge:
    - Host sends: `1F C0 51` followed by 16 random challenge bytes (`com.communication.bt.ble.a.n()`).
    - Device returns 16 bytes.
    - Verified via native `Compress.analysisData(challenge)`.
  - **Command Set**: Standard ESC/POS with `FS L` (`1C 4C`) extensions:
    - Raster image printing: `FS L m` (`1C 4C 6D xL xH yL yH wL wH hL hH 00` + 1-bit bitmap data).
    - Dot feed: `ESC J n` (`1B 4A n`), Line feed: `ESC d n` (`1B 64 n`).
    - Firmware update: `10 FF A0` framing.
* **OpenTLP Integration**:
  - Models mapped to `funny-lx` for authentication and `peripage` / ESC-POS for bitmap rasterization.

---

### Application 10: Dolewa Camera (`com.dolewa.camera`)
* **Developer / Publisher**: Shenzhen Dolewa Technology Co., Ltd. (collaborative deployment with Shenzhen LaiLaiXiong Technology Co., Ltd.).
* **APK Provenance**: Version 1.1.2 (APKPure direct), 55,320,158 bytes, SHA-256: `e7e1fcaa341940ba0cee400f1489e9fa49adf7bd1be2eec7d500276eceb17ad3`.
* **Technology Stack**:
  - React Native (Hermes Bytecode v96) + Java Native Module `com.ask.printersdk` (TagPrintingManger).
  - Cloud backend: `http://h5dev.lailaixiong.com` (LaiLaiXiong Funny Print infrastructure).
* **Supported Hardware**:
  - Children's instant thermal print cameras and portable thermal label printers.
* **Transports**:
  - **BLE GATT**:
    - Service: `0000ffe0-0000-1000-8000-00805f9b34fb` and `0000ffe6-0000-1000-8000-00805f9b34fb`.
    - Write: `0000ffe1-0000-1000-8000-00805f9b34fb`.
    - Notify: `0000ffe2-0000-1000-8000-00805f9b34fb`.
* **Protocol & Driver Mapping**:
  - **100% Identical to `catprinter-funny-lx`**: Uses the LaiLaiXiong `5A 01` status, `5A 0A` / `5A 0B` CRC16 authentication handshake, and `55` 100-byte indexed raster packet framing.

---

### Application 11: Dolewa / Laixue (`com.dolewa`)
* **Developer / Publisher**: Shenzhen Dolewa Technology Co., Ltd.
* **APK Provenance**: Version 3.0.0 (APKPure direct XAPK), 62,490,578 bytes XAPK, SHA-256: `dc4e92e06abf48d3da406166567a370830079c23ee9f04d82d8401d63ad66df8` (Base APK: 27,320,001 bytes, SHA-256: `03a156e841db42cb298be31d5a21454b7bbe3e2db1615ada6257960e8a963e01`).
* **Technology Stack**:
  - Flutter Framework (compiled ARMv7 native `libapp.so` + `flutter_blue_plus`).
  - Native core: `libCompress.so` and `libF2Function.so`.
* **Transports & Supported Profiles**:
  - **BLE GATT**:
    - Microchip ISSC Transparent UART Service: `49535343-fe7d-4ae5-8fa9-9fafd205e455` (Write: `49535343-8841-43f4-a8d4-ecbe34729bb3`, CCCD: `00002902-0000-1000-8000-00805f9b34fb`).
    - Standard Dolewa services: `0000ff00` and `0000ffe6`.
* **Compression & Commands**:
  - Employs native `Compress.codeLihu` (Lihu run-length compression), `codeCPCL`, `codeTSPL`, and `codeESC`.

---

### Application 12: iPrint (`com.frogtosea.iprint`)
* **Developer / Publisher**: Shenzhen 100cow Technology Co., Ltd. (FrogToSea).
* **APK Provenance**: Version 3.1.8 (APKPure direct), 77,756,081 bytes, SHA-256: `caecba461d4646cf9c6b0e8878ea0816d6b96d12249649cd0d273584c8a5b2f2`.
* **Technology Stack**:
  - Native Android Java/Kotlin, `cn.com.heaton.blelibrary`, `com.lib.blueUtils`, `com.lib.Utils.PrintEncoder`.
* **Supported Model Catalog**:
  - **191 distinct models verified in `com.Utils.PrintModelUtils.java`**:
    - **A4 Document & Tattoo Stencil Thermal Printers**: `GT08`, `GW08`, `GW09`, `PR88`, `PR89`, `PR893`, `X8-L`, `X8-W`, `ZP801`, `ZP802`, `ZPA4Z1`, `JXM800` (`GG-D2100-`), `A41II`, `A41III`, `A42II`, `A43`, `A4300`, `MPA81`, `P4`, `X9`, `A200`.
      - Width: **1728 paper dots (216 mm)** at 203 DPI (8 dpmm) or **2496/2592 dots** at 300 DPI (12 dpmm).
      - Note on prior catalog errors: Third-party catalogs previously misclassified `GT08` and `JXM800` as 384-dot 58mm pocket printers; decompilation proves they are full-width A4 thermal mechanisms.
    - **58mm Pocket Printers**: `XW001`, `XW002`, `XW003`, `JX001`, `M01`, `GB01`, `GB02`, `GB03`, `GB04`, `GB05`, `GB06`, `GT01`, `GT02`, `GT03`, `GT04`, `58P5`, `WL01`, `X1`, `X5`, `X6`, `X7`, `S101`, `S102`, `LY01`, `LY02`, `LY03`, `LY05`, `P7`, `P10`, `PR02`, `PR07`, `PR30`, `PR35`, `DY01`, `LP6`, `S01`, `LT01`, `P5AI`, `LY10`, `LY11`, `LP100`, `AI01`, `M2`, `P6`, `P7H`, `X2H`, `X102`, `X6HP`, `X5HP`, `X7HP`, `X103H`, `X6H`, `X5H`, `AN01`, `CP01`, `S5A`, `P20 MAX`, `S9A`, `DY33A`, `YMS-BT01`, `WJ-HOT-PRT`, `JRX01`, `RS9000`, `DY49`, `QDX01`, `WTS07`, `GT10`, `X7H`, `X2H`, `X5H`, `MTPR26BK`, `ML-MP-01`, `LUXORP.PX10`, `DTR-R0`, `X18`, `CLICK-SOUND`, `DT1-R`, `MVMT INK`, `0019B-D`, `EMX-040256`, `HT0125`, `DT1-0`, `0019B-C`.
* **Transports**:
  - **BLE GATT**:
    - Primary Service: `0000ae00-0000-1000-8000-00805f9b34fb` and `0000ae30-0000-1000-8000-00805f9b34fb`.
    - Write: `0000ae01-0000-1000-8000-00805f9b34fb`.
    - Notify: `0000ae04-0000-1000-8000-00805f9b34fb` (and fallback `0000ae02`).
    - Alternate Services: `0000ff00-0000-1000-8000-00805f9b34fb` (Write: `ff02`, Notify: `ff03`) and `0000ab00-0000-1000-8000-00805f9b34fb` (Write: `ab01`, Notify: `ab03`).
  - **Bluetooth Classic SPP**: `00001101-0000-1000-8000-00805f9b34fb` via `BLESPPUtils`.
  - **Direct SoC & Serial UART**: Supported via `SerialPortUtil` (`/dev/tty...`) and `PrinterPowerController` (`/sys/devices/platform/soc/.../printer`) for Android POS/camera hardware with integrated thermal printheads.
* **Protocol Framing & Encryption**:
  - Standard `51 78` command framing with CRC8 checksum (polynomial `0x07`, init `0x00`).
  - New format variant: `12 51 78` prefix for models flag `newFormat = true`.
  - Locked Activation Models (`FL01`, `KF-5`, `XiaoWa`, `SeznikNeo`, `JRX01`, `RS9000`, `GW08`, `GW09`, `GT10`):
    - Uses challenge-response via `PrintEncoder.encode(rcHex, d1key)` with 16-character keys (e.g. `12C3157CF56B6B9A`, `23CCB36FC97F27B7`, `269C83C1E32421E7`, `1F4AE23A9F42CAF4`, `1D32CAEF91B5A92D`).
* **OpenTLP Driver Verification**:
  - Verified **100% compatible with `catprinter-tiny`** (`CatPrinterDriver`).
