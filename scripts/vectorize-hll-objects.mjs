/**
 * Convert public/assets/hll-objects/*.png → scalable SVG.
 *
 * Pipeline: Lanczos upscale → hard posterize (kill AA fringe) → imagetracer.
 * Soft edges from the tiny source PNGs otherwise become stair-steppy paths.
 *
 * Usage: node scripts/vectorize-hll-objects.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ImageTracer from "imagetracerjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = path.join(root, "public", "assets", "hll-objects");

const TRACE_OPTS = {
  ltres: 1.2,
  qtres: 1.2,
  pathomit: 12,
  colorsampling: 0,
  numberofcolors: 8,
  mincolorratio: 0.02,
  colorquantcycles: 2,
  blurradius: 0,
  strokewidth: 0,
  linefilter: true,
  scale: 1,
  roundcoords: 1,
  viewbox: true,
  desc: false,
};

function targetSize(width) {
  if (width >= 300) return Math.min(768, width * 2);
  return 512;
}

function posterizeChannel(v, steps = 6) {
  const q = 255 / (steps - 1);
  return Math.round(Math.round(v / q) * q);
}

async function loadForTrace(pngPath) {
  const meta = await sharp(pngPath).metadata();
  const size = targetSize(meta.width || 51);
  const { data, info } = await sharp(pngPath)
    .ensureAlpha()
    .resize(size, size, { kernel: "lanczos3", fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    let a = data[i + 3];

    // Drop black plate + faint AA halo → solid transparent / solid color.
    if (a < 96 || (r < 28 && g < 28 && b < 28)) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      continue;
    }

    out[i] = posterizeChannel(r);
    out[i + 1] = posterizeChannel(g);
    out[i + 2] = posterizeChannel(b);
    out[i + 3] = 255;
  }
  return { width: info.width, height: info.height, data: out };
}

function cleanSvg(svg) {
  let out = String(svg);
  // Drop invisible / soft fringe layers imagetracer still emits.
  out = out.replace(/<path\b[^>]*\bopacity="0(?:\.[0-4]\d*)?"[^>]*\/?>/gi, "");
  out = out.replace(/\sdesc="[^"]*"/g, "");
  // Large intrinsic size so canvas drawImage stays sharp when users enlarge markers.
  // Note: do NOT test for \bwidth= on the whole file — path attrs use stroke-width=.
  const INTRINSIC = 2048;
  out = out.replace(/<svg\b([^>]*)>/i, (_, attrs) => {
    let a = String(attrs)
      .replace(/\swidth="[^"]*"/gi, "")
      .replace(/\sheight="[^"]*"/gi, "");
    if (!/\bstyle=/i.test(a)) a += ' style="background:transparent"';
    return `<svg width="${INTRINSIC}" height="${INTRINSIC}"${a}>`;
  });
  return out;
}

async function vectorizeFile(pngPath) {
  const base = path.basename(pngPath, ".png");
  const outPath = path.join(dir, `${base}.svg`);
  const img = await loadForTrace(pngPath);
  let svg = ImageTracer.imagedataToSVG(img, TRACE_OPTS);
  svg = cleanSvg(svg);
  fs.writeFileSync(outPath, svg);
  return { base, svgW: img.width, bytes: svg.length };
}

const pngs = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".png") && !f.startsWith("_"))
  .sort();

if (!pngs.length) {
  console.error("No PNGs found in", dir);
  process.exit(1);
}

console.log(`Vectorizing ${pngs.length} HLL object PNGs → SVG…`);
let total = 0;
for (const name of pngs) {
  const info = await vectorizeFile(path.join(dir, name));
  total += info.bytes;
  console.log(
    `  ${info.base}.svg  (${info.svgW}px, ${(info.bytes / 1024).toFixed(1)} KiB)`
  );
}
console.log(`Done. ${(total / 1024).toFixed(0)} KiB SVG total.`);
