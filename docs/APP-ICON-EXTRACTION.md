# Companion App Icon Extraction & Brand Palette Guide

This guide explains how to extract an official companion app icon, derive its dominant brand colors, and add a visually grounded entry into OpenTLP's **Companion App Directory** (`KNOWN_COMPANION_APPS`).

---

## 1. Why Brand Color Palettes Instead of Remote/Proprietary Images?

In OpenTLP, we do **not** commit vendor `.png` icon files into the git repository, nor do we hotlink live image assets from Google Play (`play-lh.googleusercontent.com`):

1. **GDPR / Privacy Compliance**: Hotlinking external CDN assets from Google/Apple causes the user's browser to send dynamic IP addresses and browser fingerprints to third-party US servers without consent on page load (*LG München I, 3 O 17493/20*).
2. **Trademark & Copyright**: Distributing proprietary corporate app icons inside an open-source project creates trademark infringement risks.
3. **Offline & Performance**: Vector badges (brand color + monogram letter) require 0 network calls, work 100% offline in local PWAs, and render crisply on any display.
4. **Outbound Hyperlinks for Visual Proof**: Each card includes outbound `Play Store ↗` and `App Store ↗` links so users can open the official store page in one click to view screenshots and logos without privacy leaks on page load.

---

## 2. How to Extract an App Icon

When adding a new companion app, you need the official icon solely as an input to the palette extractor.

### Method A: Browser Save from Google Play or Apple App Store (Recommended)

1. Open the app listing in your desktop browser:
   - Google Play: `https://play.google.com/store/apps/details?id=<package_id>`
   - Apple App Store: `https://apps.apple.com/app/<app-name>/id<id>`
2. **Right-click the app icon**:
   - Select **"Open image in new tab"** or **"Save image as..."**.
   - Save it locally (e.g. `/tmp/icon.png` or `/tmp/icon.webp`).
3. Alternatively, press `F12` to open DevTools, select the icon element, and copy the `src` attribute from the `<img alt="Icon image">` or `<picture>`.

### Method B: Extracting from an Android APK

If you have downloaded the manufacturer's APK:
```bash
# Extract the highest-resolution launcher icon from the APK archive
unzip -j app.apk "res/mipmap-xxxhdpi*/ic_launcher*.png" -d /tmp/
# or
unzip -j app.apk "res/drawable-xxxhdpi*/ic_launcher*.png" -d /tmp/
```

---

## 3. Extracting the Brand Palette with `extract-app-palette.py`

OpenTLP includes a standalone color quantization CLI script at [`scripts/extract-app-palette.py`](file:///home/johannes/Documents/OpenTLP/scripts/extract-app-palette.py).

### Prerequisites
Requires Python 3 and Pillow:
```bash
python3 -m pip install Pillow
```

### Basic Usage
Pass the saved image file directly to the script:
```bash
python3 scripts/extract-app-palette.py /tmp/icon.png
```

### Full Metadata Generation
You can pass app metadata flags to generate a ready-to-paste TypeScript snippet:
```bash
python3 scripts/extract-app-palette.py /tmp/icon.png \
  --name "Munbyn Print" \
  --dev "MUNBYN / SYZ" \
  --models "ITPP941, RW401AP, Realwriter 941, ITPP130" \
  --replaces "Munbyn Print, Munbyn" \
  --play "https://play.google.com/store/apps/details?id=com.syz.mprint" \
  --appstore "https://apps.apple.com/app/munbyn-print/id1588636254"
```

### Example Terminal Output
```text
================================================================
 OpenTLP Companion App Brand Palette Extractor
================================================================
 Source: /tmp/marklife_icon.png

 Dominant Colors Extracted:
        #fb4e48  (RGB: 251,  78,  72)  [color #1]
        #ffffff  (RGB: 255, 255, 255)  [color #2]

 Recommended Primary Brand Color: #fb4e48
 Extracted Brand Palette: ['#fb4e48', '#ffffff']
 Badge Text Contrast: dark (#0f172a) (White contrast: 3.3:1, Dark contrast: 5.4:1)

 Generated KNOWN_COMPANION_APPS entry for `packages/ui-components/src/data/app-directory.ts`:

    {
        id: 'marklife',
        name: 'Marklife',
        developer: 'Marklife / Zhuhai Quin',
        brandColor: '#fb4e48',
        brandPalette: ['#fb4e48', '#ffffff'],
        badgeLetter: 'M',
        popularModels: ['P12', 'P11', 'P15', 'P50', 'M1'],
        summary: 'Official companion app for Marklife thermal printers.',
        replacesApps: ['Marklife'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.quyin.marklife',
        appStoreUrl: 'https://apps.apple.com/app/marklife/id1552317937',
    },
================================================================
```

---

## 4. How the Color Quantization Works

1. **Background Detection & Segmentation**:
   - Analyzes corner pixels to identify the canvas background color (snapping near-white backgrounds to `#ffffff`).
   - Isolates foreground illustration elements from the background.
2. **Anti-Aliasing Edge Filter (`is_blend`)**:
   - Detects intermediate pixel color transitions created by bilinear/subpixel smoothing between foreground shapes and background.
   - Discards these transition artifacts so palettes only contain the authentic visual elements (e.g. Marklife yields `#fb4e48` and `#ffffff`, rather than artificial pastel pink edge artifacts).
3. **Color Clustering**:
   - Merges nearby color shades within Euclidean distance `< 32` into unified dominant centroids.
4. **Palette Ordering**:
   - Orders primary chromatic brand colors first, followed by graphic accent colors and the background color (2–4 colors total).
5. **WCAG 2.1 Contrast Calculation**:
   - Calculates relative luminance and contrast ratio against white (`#ffffff`) and dark slate (`#0f172a`) to guarantee readable monogram badge text.

---

## 5. Adding the App to OpenTLP

1. Copy the output snippet into `KNOWN_COMPANION_APPS` in [`packages/ui-components/src/data/app-directory.ts`](file:///home/johannes/Documents/OpenTLP/packages/ui-components/src/data/app-directory.ts).
2. (Optional) If an auto-connect profile is supported, add the corresponding auto profile in [`packages/ui-components/src/data/auto-profiles.ts`](file:///home/johannes/Documents/OpenTLP/packages/ui-components/src/data/auto-profiles.ts).
3. Verify test suite passes:
   ```bash
   npm --prefix packages/ui-components test
   ```
