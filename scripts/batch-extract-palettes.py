#!/usr/bin/env python3
"""
Batch extract brand palettes for all OpenTLP companion apps from official App Store metadata.
"""

import sys
import io
import json
import re
import urllib.request
import colorsys
from PIL import Image

APPS_TO_PROCESS = [
    {
        "id": "pocket_printer",
        "search": "Pocket Printer",
        "match_developer": "Karsten",
        "fallback_color": "#6366f1"
    },
    {
        "id": "print_master",
        "search": "Print Master",
        "match_developer": "PHOMEMO",
        "fallback_color": "#2563eb"
    },
    {
        "id": "phomemo",
        "search": "Phomemo",
        "match_developer": "PHOMEMO",
        "fallback_color": "#ea580c"
    },
    {
        "id": "labelife",
        "search": "Labelife",
        "match_developer": "PHOMEMO",
        "fallback_color": "#7c3aed"
    },
    {
        "id": "munbyn_print",
        "search": "Munbyn Print",
        "match_developer": "MUNBYN",
        "fallback_color": "#06b6d4"
    },
    {
        "id": "marklife",
        "search": "Marklife",
        "match_developer": "Quyin",
        "fallback_color": "#059669"
    },
    {
        "id": "tiny_print",
        "search": "Tiny Print",
        "match_developer": "Frog",
        "fallback_color": "#d97706"
    },
    {
        "id": "niimbot",
        "search": "NIIMBOT",
        "match_developer": "Jingchen",
        "fallback_color": "#e11d48"
    },
    {
        "id": "fun_print",
        "search": "Fun Print",
        "match_developer": "Yintibao",
        "fallback_color": "#db2777"
    },
    {
        "id": "walkprint",
        "search": "WalkPrint",
        "match_developer": "efercro",
        "fallback_color": "#0284c7"
    },
    {
        "id": "peripage",
        "search": "PeriPage",
        "match_developer": "iLead",
        "fallback_color": "#0d9488"
    },
    {
        "id": "flashlabel",
        "search": "FlashLabel",
        "match_developer": "angyin",
        "fallback_color": "#16a34a"
    }
]

def extract_palette(img_bytes: bytes):
    im = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
    im = im.resize((96, 96), Image.Resampling.BILINEAR)
    width, height = im.size
    pixels = im.load()

    raw_counts = {}
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 128:
                continue
            if r > 248 and g > 248 and b > 248:
                continue
            if r < 12 and g < 12 and b < 12:
                continue
            bucket = (r // 4 * 4, g // 4 * 4, b // 4 * 4)
            raw_counts[bucket] = raw_counts.get(bucket, 0) + 1

    if not raw_counts:
        return [("#475569", (71, 85, 105), 1.0)]

    clusters = []
    for (r, g, b), count in sorted(raw_counts.items(), key=lambda x: -x[1]):
        _, _, s = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
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
    return [(f"#{r:02x}{g:02x}{b:02x}", (r, g, b), score) for r, g, b, _, score in clusters[:3]]

def fetch_app_icon(app_def):
    term = urllib.parse.quote(app_def["search"])
    url = f"https://itunes.apple.com/search?term={term}&entity=software&limit=10"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode())
        
        results = data.get("results", [])
        if not results:
            print(f"[-] No search results for {app_def['search']}")
            return None, None
        
        # Look for matching developer or title
        target = None
        match_dev = app_def.get("match_developer", "").lower()
        for res in results:
            seller = res.get("sellerName", "").lower()
            artist = res.get("artistName", "").lower()
            track = res.get("trackName", "").lower()
            bundle = res.get("bundleId", "").lower()
            if match_dev and (match_dev in seller or match_dev in artist or match_dev in bundle):
                target = res
                break
        
        if not target and results:
            target = results[0]
            
        icon_url = target.get("artworkUrl512") or target.get("artworkUrl100")
        app_name = target.get("trackName")
        seller = target.get("sellerName") or target.get("artistName")
        
        print(f"[+] Found: {app_name} by {seller}")
        print(f"    Icon URL: {icon_url}")
        
        img_req = urllib.request.Request(icon_url, headers=headers)
        with urllib.request.urlopen(img_req, timeout=10) as img_r:
            img_bytes = img_r.read()
        return img_bytes, target
    except Exception as e:
        print(f"[!] Error fetching {app_def['search']}: {e}")
        return None, None

def main():
    import urllib.parse
    results_map = {}
    for app_def in APPS_TO_PROCESS:
        app_id = app_def["id"]
        print(f"\nProcessing {app_id} ({app_def['search']})...")
        img_bytes, meta = fetch_app_icon(app_def)
        if img_bytes:
            palette = extract_palette(img_bytes)
            primary_hex = palette[0][0]
            print(f"    Dominant Color: {primary_hex}")
            results_map[app_id] = {
                "color": primary_hex,
                "palette": [p[0] for p in palette],
                "meta": meta
            }
        else:
            print(f"    Using fallback: {app_def['fallback_color']}")
            results_map[app_id] = {
                "color": app_def["fallback_color"],
                "palette": [app_def["fallback_color"]],
                "meta": None
            }
            
    print("\n" + "="*60)
    print("EXTRACTION SUMMARY")
    print("="*60)
    for app_id, data in results_map.items():
        print(f"  {app_id:15s}: {data['color']}")
        
    with open("scripts/extracted_palettes.json", "w") as f:
        json.dump(results_map, f, indent=2)
    print("\nSaved to scripts/extracted_palettes.json")

if __name__ == "__main__":
    main()
