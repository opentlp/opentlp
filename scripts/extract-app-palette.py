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


def is_blend(c, c1, c2) -> bool:
    """Check if color c is an intermediate anti-aliasing blend between c1 and c2."""
    v = [c2[i] - c1[i] for i in range(3)]
    v_norm_sq = sum(x * x for x in v)
    if v_norm_sq == 0:
        return False
    diff = [c[i] - c1[i] for i in range(3)]
    t = sum(diff[i] * v[i] for i in range(3)) / v_norm_sq
    if 0.05 < t < 0.95:
        perp = [diff[i] - t * v[i] for i in range(3)]
        perp_dist = (sum(x * x for x in perp)) ** 0.5
        if perp_dist < 18.0:
            return True
    return False


def extract_palette(img_bytes: bytes):
    """Extract distinct visual colors from image bytes (background + foreground elements)."""
    im = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    im = im.resize((96, 96), Image.Resampling.BILINEAR)
    width, height = im.size
    px = im.load()
    pixels = [px[x, y] for y in range(height) for x in range(width)]

    # 1. Detect background from corner regions
    corner_samples = []
    for y in (0, 1, 2, height - 3, height - 2, height - 1):
        for x in (0, 1, 2, width - 3, width - 2, width - 1):
            corner_samples.append(pixels[y * width + x])
    med_r = int(sorted(c[0] for c in corner_samples)[len(corner_samples) // 2])
    med_g = int(sorted(c[1] for c in corner_samples)[len(corner_samples) // 2])
    med_b = int(sorted(c[2] for c in corner_samples)[len(corner_samples) // 2])

    if med_r > 246 and med_g > 246 and med_b > 246:
        bg_rgb = (255, 255, 255)
        bg_hex = "#ffffff"
    elif med_r < 12 and med_g < 12 and med_b < 12:
        bg_rgb = (0, 0, 0)
        bg_hex = "#000000"
    else:
        bg_rgb = (med_r, med_g, med_b)
        bg_hex = f"#{med_r:02x}{med_g:02x}{med_b:02x}"

    # 2. Cluster pixels into dominant color regions
    clusters = []  # list of [ [r, g, b], count ]
    for r, g, b in pixels:
        matched = False
        for c in clusters:
            dist = ((r - c[0][0]) ** 2 + (g - c[0][1]) ** 2 + (b - c[0][2]) ** 2) ** 0.5
            if dist < 36.0:
                c[0][0] = (c[0][0] * c[1] + r) / (c[1] + 1)
                c[0][1] = (c[0][1] * c[1] + g) / (c[1] + 1)
                c[0][2] = (c[0][2] * c[1] + b) / (c[1] + 1)
                c[1] += 1
                matched = True
                break
        if not matched:
            clusters.append([[float(r), float(g), float(b)], 1])

    total = len(pixels)
    clusters.sort(key=lambda c: -c[1])

    # Filter out small noise (< 3.0% area)
    valid_clusters = [c for c in clusters if (c[1] / total) * 100 >= 3.0]

    # Separate foreground from background
    fg_clusters = []
    for c in valid_clusters:
        dist_to_bg = ((c[0][0] - bg_rgb[0]) ** 2 + (c[0][1] - bg_rgb[1]) ** 2 + (c[0][2] - bg_rgb[2]) ** 2) ** 0.5
        if dist_to_bg >= 35.0:
            fg_clusters.append(c)

    if not fg_clusters:
        return [(bg_hex, bg_rgb, 1.0)]

    primary_fg = fg_clusters[0][0]

    # Filter out anti-aliasing edge blends and merge similar foreground shades
    distinct_fg = [primary_fg]
    for c in fg_clusters[1:]:
        if any(((c[0][0] - dfg[0]) ** 2 + (c[0][1] - dfg[1]) ** 2 + (c[0][2] - dfg[2]) ** 2) ** 0.5 < 32.0 for dfg in distinct_fg):
            continue
        if not is_blend(c[0], primary_fg, bg_rgb):
            blend_with_any = any(is_blend(c[0], dfg, bg_rgb) for dfg in distinct_fg)
            if not blend_with_any:
                distinct_fg.append(c[0])

    palette_entries = []
    # Add distinct foreground colors
    for dfg in distinct_fg[:3]:
        r, g, b = int(round(dfg[0])), int(round(dfg[1])), int(round(dfg[2]))
        if r > 246 and g > 246 and b > 246:
            palette_entries.append(("#ffffff", (255, 255, 255), 1.0))
        else:
            palette_entries.append((f"#{r:02x}{g:02x}{b:02x}", (r, g, b), 1.0))

    # Add background color if distinct
    if bg_hex not in [p[0] for p in palette_entries]:
        palette_entries.append((bg_hex, bg_rgb, 1.0))

    # Sort so vibrant chromatic colors precede neutrals (#ffffff / #000000)
    palette_entries.sort(key=lambda p: (
        1 if p[0].lower() in ('#ffffff', '#000000', '#fefefe', '#fdfdfd', '#fef6f6')
        else -abs(p[1][0] - p[1][1]) - abs(p[1][1] - p[1][2])
    ))

    return palette_entries[:4]


def ansi_swatch(r: int, g: int, b: int) -> str:
    """Format an ANSI truecolor swatch for terminal output."""
    return f"\033[48;2;{r};{g};{b}m    \033[0m"


def main():
    args = parse_args()
    img_bytes, resolved_source = fetch_source_image(args.source)
    palette = extract_palette(img_bytes)

    primary_hex, (pr, pg, pb), _ = palette[0]
    secondary_hex, (sr, sg, sb), _ = palette[1] if len(palette) > 1 else palette[0]
    palette_hex_list = [p[0] for p in palette]

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
    for idx, (hex_col, (r, g, b), _) in enumerate(palette, 1):
        swatch = ansi_swatch(r, g, b)
        print(f"   {swatch} {hex_col}  (RGB: {r:3d}, {g:3d}, {b:3d})  [color #{idx}]")

    print(f"\n Recommended Primary Brand Color: {primary_hex}")
    print(f" Extracted Brand Palette: {palette_hex_list}")
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
        brandPalette: {palette_hex_list!r},
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
