/**
 * Build accessibility collision grids from Maps Let Loose PNG overlays.
 * Source: tmp-maps-let-loose/assets/accessibility/{MapId}_Accessible.png
 * Output: public/data/accessibility/{mapId}.json
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE_DIR = path.join(ROOT, "tmp-maps-let-loose", "assets", "accessibility");
const OUT_DIR = path.join(ROOT, "public", "data", "accessibility");
const PUBLIC_OVERLAY_DIR = path.join(ROOT, "public", "maps", "accessibility");
const GRID = 96;
const PADDING_CELLS = 1;
const ALPHA_THRESHOLD = 40;
const COLOR_THRESHOLD = 24;
/** Colored pixels in MLL accessibility PNG = no-drive zones; transparent = open. */

const MAP_IDS = fs.existsSync(SOURCE_DIR)
  ? fs
      .readdirSync(SOURCE_DIR)
      .filter((f) => f.endsWith("_Accessible.png"))
      .map((f) => f.replace("_Accessible.png", ""))
  : [];

function dilate(grid, size, radius) {
  if (radius <= 0) return grid;
  const out = new Uint8Array(grid.length);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (!grid[i]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          out[ny * size + nx] = 1;
        }
      }
    }
  }
  return out;
}

async function extractMap(mapId) {
  const src = path.join(SOURCE_DIR, `${mapId}_Accessible.png`);
  if (!fs.existsSync(src)) {
    console.warn(`skip ${mapId}: missing ${src}`);
    return null;
  }

  const { data } = await sharp(src)
    .resize(GRID, GRID, { fit: "fill", kernel: sharp.kernel.nearest })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const blocked = new Uint8Array(GRID * GRID);
  for (let i = 0; i < GRID * GRID; i++) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const a = data[o + 3];
    blocked[i] = a >= ALPHA_THRESHOLD && r + g + b >= COLOR_THRESHOLD ? 1 : 0;
  }

  const padded = dilate(blocked, GRID, PADDING_CELLS);
  const bits = Array.from(padded, (v) => (v ? "1" : "0")).join("");

  fs.mkdirSync(PUBLIC_OVERLAY_DIR, { recursive: true });
  fs.copyFileSync(src, path.join(PUBLIC_OVERLAY_DIR, `${mapId}_Accessible.png`));

  return {
    mapId,
    gridSize: GRID,
    paddingCells: PADDING_CELLS,
    blocked: bits,
  };
}

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Missing MLL source at ${SOURCE_DIR}. Clone maps-let-loose first.`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let count = 0;
  for (const mapId of MAP_IDS) {
    const payload = await extractMap(mapId);
    if (!payload) continue;
    const out = path.join(OUT_DIR, `${mapId}.json`);
    fs.writeFileSync(out, JSON.stringify(payload));
    count++;
    console.log(`Wrote ${out}`);
  }
  console.log(`Done: ${count} maps`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
