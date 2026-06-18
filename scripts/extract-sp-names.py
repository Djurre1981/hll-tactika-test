"""Extract strongpoint name label cutouts from maps-let-loose SP PNGs."""
import json
import re
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Pillow required: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "_maps_source" / "data.js"
POINTS_DIR = ROOT / "maps" / "points"
OUT = ROOT / "data" / "strongpoint-names.json"
MAP_SIZE = 1920
NAME_PAD_ABOVE = 52
NAME_BAND_BELOW = 55


def js_to_json(js: str) -> str:
    js = re.sub(r"//.*?$", "", js, flags=re.MULTILINE)
    js = re.sub(r",(\s*[\]}])", r"\1", js)
    js = re.sub(r'(?<=[{\s,])(\w+)\s*:', r'"\1":', js)
    return js


def extract_block(text: str, name: str) -> str:
    marker = f"const {name} ="
    start = text.index(marker) + len(marker)
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
        elif ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    raise ValueError(name)


def bounds(rects):
    top = min(r[1] for r in rects)
    left = min(r[0] for r in rects)
    right = max(r[0] + r[2] for r in rects)
    bottom = max(r[1] + r[3] for r in rects)
    return left, top, right, bottom


def main():
    text = SOURCE.read_text(encoding="utf-8")
    grids = json.loads(js_to_json(extract_block(text, "POINT_COORDS")))
    result = {}

    for map_id, grid in grids.items():
        full_path = POINTS_DIR / f"{map_id}_SP_NoMap.png"
        bare_path = POINTS_DIR / f"{map_id}_SP_NoMap2.png"
        if not full_path.exists() or not bare_path.exists():
            continue

        full = Image.open(full_path).convert("RGBA")
        bare = Image.open(bare_path).convert("RGBA")
        sectors = {}

        for row_idx, row in enumerate(grid):
            if not row:
                continue
            for col_idx, cell in enumerate(row):
                if not cell:
                    continue

                left, top, right, bottom = bounds(cell)
                name_top = max(0, top - NAME_PAD_ABOVE)
                name_bottom = top + NAME_BAND_BELOW
                name_left = left
                name_right = right

                label = Image.new("RGBA", (name_right - name_left, name_bottom - name_top), (0, 0, 0, 0))
                has_pixels = False
                for y in range(name_top, name_bottom):
                    for x in range(name_left, name_right):
                        p1 = full.getpixel((x, y))
                        p2 = bare.getpixel((x, y))
                        if p1[3] > 20 and (p2[3] < 10 or p1[:3] != p2[:3]):
                            label.putpixel((x - name_left, y - name_top), p1)
                            has_pixels = True

                if not has_pixels:
                    continue

                bbox = label.getbbox()
                if bbox:
                    label = label.crop(bbox)
                    name_left += bbox[0]
                    name_top += bbox[1]
                    name_right = name_left + (bbox[2] - bbox[0])
                    name_bottom = name_top + (bbox[3] - bbox[1])

                rel_path = f"maps/points/labels/{map_id}_{row_idx}{col_idx}.png"
                out_path = ROOT / rel_path
                out_path.parent.mkdir(parents=True, exist_ok=True)
                label.save(out_path)

                sectors[f"{row_idx}{col_idx}"] = {
                    "row": row_idx,
                    "col": col_idx,
                    "left": round(name_left / MAP_SIZE * 100, 4),
                    "top": round(name_top / MAP_SIZE * 100, 4),
                    "width": round((name_right - name_left) / MAP_SIZE * 100, 4),
                    "height": round((name_bottom - name_top) / MAP_SIZE * 100, 4),
                    "image": rel_path,
                }

        if sectors:
            result[map_id] = sectors

    OUT.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} ({len(result)} maps)")


if __name__ == "__main__":
    main()
