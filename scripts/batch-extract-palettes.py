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
        "match_developer": "Yinxiaoqian",
        "fallback_color": "#f84c48"
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

def is_blend(c, c1, c2) -> bool:
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
    im = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    im = im.resize((96, 96), Image.Resampling.BILINEAR)
    width, height = im.size
    px = im.load()
    pixels = [px[x, y] for y in range(height) for x in range(width)]

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

    clusters = []
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
    valid_clusters = [c for c in clusters if (c[1] / total) * 100 >= 3.0]

    fg_clusters = []
    for c in valid_clusters:
        dist_to_bg = ((c[0][0] - bg_rgb[0]) ** 2 + (c[0][1] - bg_rgb[1]) ** 2 + (c[0][2] - bg_rgb[2]) ** 2) ** 0.5
        if dist_to_bg >= 35.0:
            fg_clusters.append(c)

    if not fg_clusters:
        return [(bg_hex, bg_rgb, 1.0)]

    primary_fg = fg_clusters[0][0]
    distinct_fg = [primary_fg]
    for c in fg_clusters[1:]:
        if any(((c[0][0] - dfg[0]) ** 2 + (c[0][1] - dfg[1]) ** 2 + (c[0][2] - dfg[2]) ** 2) ** 0.5 < 32.0 for dfg in distinct_fg):
            continue
        if not is_blend(c[0], primary_fg, bg_rgb):
            blend_with_any = any(is_blend(c[0], dfg, bg_rgb) for dfg in distinct_fg)
            if not blend_with_any:
                distinct_fg.append(c[0])

    palette_entries = []
    for dfg in distinct_fg[:3]:
        r, g, b = int(round(dfg[0])), int(round(dfg[1])), int(round(dfg[2]))
        if r > 246 and g > 246 and b > 246:
            palette_entries.append(("#ffffff", (255, 255, 255), 1.0))
        else:
            palette_entries.append((f"#{r:02x}{g:02x}{b:02x}", (r, g, b), 1.0))

    if bg_hex not in [p[0] for p in palette_entries]:
        palette_entries.append((bg_hex, bg_rgb, 1.0))

    palette_entries.sort(key=lambda p: (
        1 if p[0].lower() in ('#ffffff', '#000000', '#fefefe', '#fdfdfd', '#fef6f6')
        else -abs(p[1][0] - p[1][1]) - abs(p[1][1] - p[1][2])
    ))
    return palette_entries[:4]

def fetch_app_icon(app_def):
    import os
    local_path = f"scripts/app_icons/{app_def['id']}.png"
    if os.path.exists(local_path):
        with open(local_path, "rb") as f:
            return f.read(), {"local": True}

    term = urllib.parse.quote(app_def["search"])
    url = f"https://itunes.apple.com/search?term={term}&entity=software&limit=10"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
        
        results = data.get("results", [])
        if not results:
            return None, None
        
        target = None
        match_dev = app_def.get("match_developer", "").lower()
        for res in results:
            seller = res.get("sellerName", "").lower()
            artist = res.get("artistName", "").lower()
            bundle = res.get("bundleId", "").lower()
            if match_dev and (match_dev in seller or match_dev in artist or match_dev in bundle):
                target = res
                break
        
        if not target and results:
            target = results[0]
            
        icon_url = target.get("artworkUrl512") or target.get("artworkUrl100")
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
