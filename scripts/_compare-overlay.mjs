import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const mapId = process.argv[2] || "Carentan";
const vectorsPath = process.argv[3] || path.join(ROOT, "public/data/accessibility", `${mapId}.vectors.json`);
const pngPath = path.join(ROOT, "public/maps/accessibility", `${mapId}_Accessible.png`);
const outPath = path.join(ROOT, "tmp", `${mapId}-overlay-compare.png`);

const vectors = JSON.parse(fs.readFileSync(vectorsPath, "utf8"));
const size = 1920;

const svgParts = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
];

for (const o of vectors.obstacles) {
  if (o.points.length < 3) continue;
  const pts = o.points.map((p) => `${(p.x / 100) * size},${(p.y / 100) * size}`).join(" ");
  svgParts.push(`<polygon points="${pts}" fill="rgba(255,60,60,0.45)" stroke="rgba(255,255,255,0.9)" stroke-width="2"/>`);
}
svgParts.push("</svg>");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const svg = svgParts.join("");
const svgBuf = Buffer.from(svg);

await sharp(pngPath)
  .resize(size, size)
  .composite([{ input: svgBuf, top: 0, left: 0 }])
  .png()
  .toFile(outPath);

console.log("Wrote", outPath, "—", vectors.obstacleCount, "shapes");
