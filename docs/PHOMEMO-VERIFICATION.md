# Phomemo original-app verification

Inspected on 2026-11-11 using JADX against locally available original Android
APKs. Only model, geometry and protocol facts are recorded here. No APK,
decompiled implementation, or manufacturer artwork is included in this repository.

| App | Package | Version | APK SHA-256 |
| --- | --- | --- | --- |
| Phomemo | `com.quyin.phomemo` | 4.0.0 (338) | `ffa6b379f4d3c2061b3e9ae6424a84229c25042360ec7fc953a488bbaf23ac00` |
| Print Master | `com.project.aimotech.printmaster` | 5.21.1 (5210102) | `e7e7c6f43b3d65514cbdde3fe3b31b46adcb2ccfc780b5f059f9eb6887fd5f27` |

## M02 Pro

In Phomemo's `classes5.dex`, factory `Bk.a` selects `Ck.d` for both `M02 Pro`
and `sandymaro`. It inherits `Dk.c`, which supplies a 0.0847 mm dot pitch
(approximately 300 dpi) and a 576-dot width. `Dk.c.I` returns a 576-dot bitmap
for roll media. `Dk.a` supplies 53 mm stock and registers that roll size;
53 mm is not the printable bitmap width.

This supersedes the 624-dot/78-byte value inherited from public model tables.
The roll bitmap has 72 bytes per row. Core retains its conventional rounded
12 dots/mm value for 300-dpi devices. Physical prints have not been verified.

## M220

Print Master's `assets/DefaultPrinter.json` maps prefixes `Q054` and `Q155` to
M220, series M200. In `classes5.dex`, `M220Printer` inherits `M200Printer`;
its override changes the product icon, not the raster encoder. `M200Printer`
records 576 dots/72 mm and uses the shared Quin raw-raster path. The SDK's
`InsSet.Y` is `1d 76 30 00`, matching Core's GS v 0 raster command.

In `classes12.dex`, `ImageTransformFactory` independently gives M220 576 dots,
72 mm and 203 dpi, selecting `LeftFillTransform`. `PrintImageTransform`
accepts label direction/size exchange and a rotation degree. Its transform
rotates by the requested degree, or by 270 degrees for exchanged dimensions.
The original app therefore supports paper-dependent orientation; its M200
series name does not establish a universal 90-degree firmware correction.

Core's canvas convention remains X along feed, Y across the head. A selected
top feed edge rotates the design 270 degrees before the driver encodes it:
a 240 x 120 design becomes 120 feed rows with 240 content dots across the head,
centred in the M220's 576-dot raster. This permits 30 x 15 mm designs on rolls
whose 30 mm edge spans the head. The UI displays the resulting physical
footprint; the loaded roll must match it. An asymmetric corner test checks
wire row order and both sides of the head to detect mirroring or an extra turn.

## Serial selection

Both reports used the advertised name `Serial Printer`. The old M02 and M110
drivers derived their model solely from that transport name, ignoring
`PrintManager`'s selected model. They consequently returned their first
model's geometry (M02: 384 dots/8 dots per mm; M110: 344 dots/8 dots per mm).
Both now implement `setModel`, prefer an exact explicit model selection, and
clear that selection on unbind so subsequent automatic connections detect the
new printer. Integration tests cover both serial profiles and reconnects.
