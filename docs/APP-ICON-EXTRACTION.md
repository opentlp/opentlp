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
 Source: /tmp/icon.png

 Dominant Colors Extracted:
        #06b6d4  (RGB:   6, 182, 212)  [rank #1]
        #0891b2  (RGB:   8, 145, 178)  [rank #2]
        #e0f2fe  (RGB: 224, 242, 254)  [rank #3]

 Recommended Primary Brand Color: #06b6d4
 Badge Text Contrast: white (#ffffff) (White contrast: 4.8:1, Dark contrast: 4.4:1)

 Generated KNOWN_COMPANION_APPS entry for `packages/ui-components/src/data/app-directory.ts`:

    {
        id: 'munbyn_print',
        name: 'Munbyn Print',
        developer: 'MUNBYN / SYZ',
        brandColor: '#06b6d4',
        badgeLetter: 'M',
        popularModels: ['ITPP941', 'RW401AP', 'Realwriter 941', 'ITPP130'],
        summary: 'Official companion app for Munbyn Print thermal printers.',
        replacesApps: ['Munbyn Print', 'Munbyn'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.syz.mprint',
        appStoreUrl: 'https://apps.apple.com/app/munbyn-print/id1588636254',
    },
================================================================
```

---

## 4. How the Color Quantization Works

1. **Noise & Card Filtering**:
   - Ignores transparent alpha pixels (`a < 128`).
   - Ignores background canvas padding (near-white pixels `RGB > 248` and extreme black borders `RGB < 12`).
2. **Vibrancy & Saturation Weighting**:
   - Converts pixels to HLS color space.
   - Weights candidate clusters by `count * (saturation * 1.8 + 0.25)` to elevate vibrant corporate brand accents over neutral gray or white background surfaces.
3. **Euclidean Color Clustering**:
   - Merges nearby color shades within distance `< 32` in RGB space into unified dominant centroids.
4. **WCAG 2.1 Contrast Calculation**:
   - Calculates relative luminance and contrast ratio against white (`#ffffff`) and dark slate (`#0f172a`) to guarantee readable monogram badge text.

---

## 5. Adding the App to OpenTLP

1. Copy the output snippet into `KNOWN_COMPANION_APPS` in [`packages/ui-components/src/data/app-directory.ts`](file:///home/johannes/Documents/OpenTLP/packages/ui-components/src/data/app-directory.ts).
2. (Optional) If an auto-connect profile is supported, add the corresponding auto profile in [`packages/ui-components/src/data/auto-profiles.ts`](file:///home/johannes/Documents/OpenTLP/packages/ui-components/src/data/auto-profiles.ts).
3. Verify test suite passes:
   ```bash
   npm --prefix packages/ui-components test
   ```
