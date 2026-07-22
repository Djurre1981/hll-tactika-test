/**
 * Render filled vector shapes only (no mask, no strokes).
 * Usage:
 *   node scripts/render-vectors-filled.mjs --map=Carentan
 *   node scripts/render-vectors-filled.mjs --map=Carentan --size=4096
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const VECTORS_DIR = path.join(ROOT, "public", "data", "accessibility");
const OUT_DIR = path.join(ROOT, "tmp", "accessibility-mono");

function parseArgs(argv) {
  let mapId = "Carentan";
  let size = 4096;
  for (const arg of argv) {
    if (arg.startsWith("--map=")) mapId = arg.slice(6);
    else if (arg.startsWith("--size=")) size = Number(arg.slice(7));
  }
  if (!Number.isFinite(size) || size < 256) size = 4096;
  return { mapId, size };
}

function vectorsToFilledSvg(obstacles, size) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="100%" height="100%" fill="white"/>`,
  ];
  for (const o of obstacles) {
    if (!o.points || o.points.length < 3) continue;
    const pts = o.points.map((p) => `${(p.x / 100) * size},${(p.y / 100) * size}`).join(" ");
    parts.push(`<polygon points="${pts}" fill="black" stroke="none"/>`);
  }
  parts.push("</svg>");
  return parts.join("");
}

async function main() {
  const { mapId, size } = parseArgs(process.argv.slice(2));
  const vectorsPath = path.join(VECTORS_DIR, `${mapId}.vectors.json`);
  if (!fs.existsSync(vectorsPath)) {
    console.error(`Missing ${vectorsPath}`);
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(vectorsPath, "utf8"));
  const svg = Buffer.from(vectorsToFilledSvg(payload.obstacles, size));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${mapId}-mono-shapes-${size}.png`);
  await sharp(svg).png({ compressionLevel: 6 }).toFile(outPath);

  console.log(`Wrote ${outPath} — ${payload.obstacleCount} shapes @ ${size}×${size}px`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
