#!/usr/bin/env python3
"""
Extract App Brand Palette & CompanionAppInfo Generator for OpenTLP.

Analyzes an app icon (local image file or URL) to extract dominant brand colors,
secondary accents, WCAG contrast ratings, and generates ready-to-use TypeScript
snippets for `KNOWN_COMPANION_APPS` in `packages/ui-components/src/data/app-directory.ts`.

Usage:
  python3 scripts/extract-app-palette.py <path-or-url-to-image>
  python3 scripts/extract-app-palette.py ./app_icon.png --name "Munbyn Print" --dev "MUNBYN / SYZ"
"""

import sys
import os
import io
import re
import argparse
import colorsys
import urllib.request
import urllib.error

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow is required. Run 'pip install Pillow' to install it.", file=sys.stderr)
    sys.exit(1)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Extract dominant brand colors from an app icon and generate OpenTLP metadata."
    )
    parser.add_argument(
        "source",
        help="Path to local image file (PNG/JPG/WebP) or direct image / store URL."
    )
    parser.add_argument("--name", help="App name (e.g. 'Munbyn Print')")
    parser.add_argument("--dev", help="Developer name (e.g. 'MUNBYN / SYZ')")
    parser.add_argument("--models", help="Comma-separated popular models (e.g. 'ITPP941, RW401AP')")
    parser.add_argument("--replaces", help="Comma-separated replaced app names (e.g. 'Munbyn Print, Munbyn')")
    parser.add_argument("--play", help="Google Play Store URL")
    parser.add_argument("--appstore", help="Apple App Store URL")
    return parser.parse_args()


def fetch_source_image(source: str):
    """Load image bytes from a local file path or URL."""
    if os.path.exists(source):
        with open(source, "rb") as f:
            return f.read(), source

    if source.startswith("http://") or source.startswith("https://"):
        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "image/*,text/html,*/*",
            "Accept-Language": "en-US,en;q=0.9",
        }

        # If it's a Google Play or App Store landing page, attempt to resolve og:image first
        if "play.google.com" in source or "apps.apple.com" in source:
            try:
                req = urllib.request.Request(source, headers=headers)
                with urllib.request.urlopen(req, timeout=10) as res:
                    html = res.read().decode("utf-8", errors="ignore")
                match = re.search(r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', html)
                if not match:
                    match = re.search(r'<img[^>]+alt=["\']Icon image["\'][^>]+src=["\']([^"\']+)["\']', html)
                if match:
                    img_url = match.group(1).replace("&amp;", "&")
                    print(f"[*] Found icon in store page: {img_url}")
                    img_req = urllib.request.Request(img_url, headers=headers)
                    with urllib.request.urlopen(img_req, timeout=10) as img_res:
                        return img_res.read(), img_url
            except urllib.error.HTTPError as e:
                if e.code == 403:
                    print("\n[!] Note: Google/Apple store servers blocked automated scraping (HTTP 403).", file=sys.stderr)
                    print("[!] Please open the store page in your browser, right-click the app icon -> 'Save image as...',", file=sys.stderr)
                    print(f"[!] and run: python3 scripts/extract-app-palette.py ./saved_icon.png\n", file=sys.stderr)
                    sys.exit(1)
                raise

        # Direct image URL
        req = urllib.request.Request(source, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.read(), source

    print(f"Error: File or URL not found: {source}", file=sys.stderr)
    sys.exit(1)


def linearize(c: float) -> float:
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(r: int, g: int, b: int) -> float:
    """WCAG 2.1 relative luminance."""
    return 0.2126 * linearize(r / 255.0) + 0.7152 * linearize(g / 255.0) + 0.0722 * linearize(b / 255.0)


def contrast_ratio(lum1: float, lum2: float) -> float:
    lighter = max(lum1, lum2)
    darker = min(lum1, lum2)
    return (lighter + 0.05) / (darker + 0.05)


def extract_palette(img_bytes: bytes):
    """Cluster and score dominant brand colors from image bytes."""
    im = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
    # Resize thumbnail to 96x96 for uniform processing
    im = im.resize((96, 96), Image.Resampling.BILINEAR)
    width, height = im.size
    pixels = im.load()

    raw_counts = {}
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 128:
                continue
            # Filter pure background white or extreme black noise
            if r > 248 and g > 248 and b > 248:
                continue
            if r < 12 and g < 12 and b < 12:
                continue
            # Discretize into 8-bit buckets
            bucket = (r // 4 * 4, g // 4 * 4, b // 4 * 4)
            raw_counts[bucket] = raw_counts.get(bucket, 0) + 1

    if not raw_counts:
        # Fallback for monochrome / black-and-white icon
        return [("#475569", (71, 85, 105), 1.0)]

    # Cluster colors by Euclidean distance
    clusters = []  # list of [r, g, b, count, score]
    for (r, g, b), count in sorted(raw_counts.items(), key=lambda x: -x[1]):
        _, _, s = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
        # Prioritize saturated brand colors over dull grays
        vibrancy_weight = count * (s * 1.8 + 0.25)
        merged = False
        for i, (cr, cg, cb, cw, cs) in enumerate(clusters):
            dist = ((r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2) ** 0.5
            if dist < 32:
                clusters[i] = (cr, cg, cb, cw + count, cs + vibrancy_weight)
                merged = True
                break
        if not merged:
            clusters.append((r, g, b, count, vibrancy_weight))

    clusters.sort(key=lambda c: -c[4])

    results = []
    for r, g, b, count, score in clusters[:5]:
        hex_color = f"#{r:02x}{g:02x}{b:02x}"
        results.append((hex_color, (r, g, b), score))

    return results


def ansi_swatch(r: int, g: int, b: int) -> str:
    """Format an ANSI truecolor swatch for terminal output."""
    return f"\033[48;2;{r};{g};{b}m    \033[0m"


def main():
    args = parse_args()
    img_bytes, resolved_source = fetch_source_image(args.source)
    palette = extract_palette(img_bytes)

    primary_hex, (pr, pg, pb), _ = palette[0]
    secondary_hex, (sr, sg, sb), _ = palette[1] if len(palette) > 1 else palette[0]

    # Calculate contrast
    lum = relative_luminance(pr, pg, pb)
    white_contrast = contrast_ratio(1.0, lum)
    dark_contrast = contrast_ratio(lum, relative_luminance(15, 23, 42))
    recommended_text = "white (#ffffff)" if white_contrast >= dark_contrast else "dark (#0f172a)"

    print("=" * 64)
    print(" OpenTLP Companion App Brand Palette Extractor")
    print("=" * 64)
    print(f" Source: {resolved_source}")
    print("\n Dominant Colors Extracted:")
    for idx, (hex_col, (r, g, b), score) in enumerate(palette[:4], 1):
        swatch = ansi_swatch(r, g, b)
        print(f"   {swatch} {hex_col}  (RGB: {r:3d}, {g:3d}, {b:3d})  [rank #{idx}]")

    print(f"\n Recommended Primary Brand Color: {primary_hex}")
    print(f" Badge Text Contrast: {recommended_text} (White contrast: {white_contrast:.1f}:1, Dark contrast: {dark_contrast:.1f}:1)")

    # Construct suggested TypeScript object
    name = args.name or "App Name"
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    dev = args.dev or "Manufacturer / Developer Team"
    badge_letter = name[0].upper() if name else "A"
    models_list = [m.strip() for m in args.models.split(",")] if args.models else ["Model 1", "Model 2"]
    replaces_list = [r.strip() for r in args.replaces.split(",")] if args.replaces else [name]
    play_url = args.play or (args.source if "play.google.com" in args.source else "")
    appstore_url = args.appstore or (args.source if "apps.apple.com" in args.source else "")

    print("\n Generated KNOWN_COMPANION_APPS entry for `packages/ui-components/src/data/app-directory.ts`:\n")
    ts_snippet = f"""    {{
        id: '{slug}',
        name: '{name}',
        developer: '{dev}',
        brandColor: '{primary_hex}',
        badgeLetter: '{badge_letter}',
        popularModels: {models_list!r},
        summary: 'Official companion app for {name} thermal printers.',
        replacesApps: {replaces_list!r},"""
    if play_url:
        ts_snippet += f"\n        playStoreUrl: '{play_url}',"
    if appstore_url:
        ts_snippet += f"\n        appStoreUrl: '{appstore_url}',"
    ts_snippet += "\n    },"

    print(ts_snippet)
    print("=" * 64)


if __name__ == "__main__":
    main()
