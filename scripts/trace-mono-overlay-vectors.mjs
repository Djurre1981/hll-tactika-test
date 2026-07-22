/**
 * Trace mono accessibility overlay → vectors.json (Illustrator-style workflow).
 *
 * 1. Binarize original overlay (same mono mask as --export-mono)
 * 2. ImageTrace black shapes
 * 3. Convert SVG paths → map-percent polygons
 *
 * Usage:
 *   node scripts/trace-mono-overlay-vectors.mjs
 *   node scripts/trace-mono-overlay-vectors.mjs --map=Omaha
 *   node scripts/trace-mono-overlay-vectors.mjs --skip=Carentan
 */
import fs from "node:fs";
import path from "node:path";
import ImageTracer from "imagetracerjs";
import { loadAccessibilityMono } from "./lib/accessibility-mono-mask.mjs";
import { svgToObstacles } from "./lib/obstacle-svg-import.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PNG_DIR = path.join(ROOT, "public", "maps", "accessibility");
const OUT_DIR = path.join(ROOT, "public", "data", "accessibility");
const DIST_OUT_DIR = path.join(ROOT, "dist", "data", "accessibility");

const VECTOR_VERSION = 9;

const TRACE_OPTS = {
  ltres: 0.5,
  qtres: 0.5,
  pathomit: 4,
  colorsampling: 0,
  numberofcolors: 2,
  mincolorratio: 0,
  colorquantcycles: 1,
  blurradius: 0,
  blurdelta: 0,
  strokewidth: 0,
  linefilter: false,
  scale: 1,
  roundcoords: 1,
  viewbox: true,
  desc: false,
  pal: [
    { r: 0, g: 0, b: 0, a: 255 },
    { r: 255, g: 255, b: 255, a: 255 },
  ],
};

function parseArgs(argv) {
  let mapFilter = null;
  const skipMaps = new Set(["Carentan"]);
  for (const arg of argv) {
    if (arg.startsWith("--map=")) mapFilter = arg.slice(6);
    else if (arg.startsWith("--skip=")) {
      for (const id of arg.slice(7).split(",")) skipMaps.add(id.trim());
    }
    else if (arg === "--all") skipMaps.clear();
  }
  return { mapFilter, skipMaps };
}

function writeVectors(mapId, payload) {
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${mapId}.vectors.json`);
  fs.writeFileSync(outPath, json);

  if (fs.existsSync(path.join(ROOT, "dist"))) {
    fs.mkdirSync(DIST_OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(DIST_OUT_DIR, `${mapId}.vectors.json`), json);
  }

  return outPath;
}

async function traceMonoMap(mapId) {
  const pngPath = path.join(PNG_DIR, `${mapId}_Accessible.png`);
  if (!fs.existsSync(pngPath)) {
    console.error(`Missing ${pngPath}`);
    return null;
  }

  const { imageData, width, height } = await loadAccessibilityMono(pngPath);
  const svg = ImageTracer.imagedataToSVG(imageData, TRACE_OPTS);
  const { viewBox, obstacles, stats, importOptions } = svgToObstacles(svg, {
    skipWhite: true,
    blackOnly: true,
    mapId,
  });

  for (const obstacle of obstacles) {
    obstacle.traceVersion = VECTOR_VERSION;
  }

  const vertexCounts = obstacles.map((o) => o.points.length);
  const payload = {
    version: VECTOR_VERSION,
    mapId,
    sourceSize: width,
    traceMode: "mono-overlay-trace",
    traceEngine: "imagetracerjs",
    obstacleCount: obstacles.length,
    obstacles,
    stats: {
      sourceShapes: stats.sourceShapes,
      skippedSmall: stats.skippedSmall,
      vertices: vertexCounts.reduce((sum, n) => sum + n, 0),
      avgVertices: obstacles.length
        ? Math.round((vertexCounts.reduce((sum, n) => sum + n, 0) / obstacles.length) * 10) / 10
        : 0,
      maxVertices: vertexCounts.length ? Math.max(...vertexCounts) : 0,
    },
    viewBox: [viewBox.x, viewBox.y, viewBox.width, viewBox.height],
    flattenToleranceSvg: importOptions.flattenTolerance,
    minAreaSvg: importOptions.minAreaSvg,
  };

  const outPath = writeVectors(mapId, payload);
  console.log(
    `Wrote ${outPath} [${payload.traceMode}] — ${payload.obstacleCount} shapes, ${payload.stats.vertices} vertices`
  );
  return payload;
}

async function main() {
  const { mapFilter, skipMaps } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(PNG_DIR)) {
    console.error(`Missing PNG dir ${PNG_DIR}`);
    process.exit(1);
  }

  let mapIds = fs
    .readdirSync(PNG_DIR)
    .filter((name) => name.endsWith("_Accessible.png"))
    .map((name) => name.replace("_Accessible.png", ""));

  if (mapFilter) {
    mapIds = mapIds.filter((id) => id.toLowerCase() === mapFilter.toLowerCase());
    if (!mapIds.length) {
      console.error(`No accessibility PNG found for map "${mapFilter}"`);
      process.exit(1);
    }
  } else {
    mapIds = mapIds.filter((id) => !skipMaps.has(id));
  }

  for (const mapId of mapIds) {
    await traceMonoMap(mapId);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
