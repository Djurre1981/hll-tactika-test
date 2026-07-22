/**
 * Import Illustrator-traced obstacle SVG → public/data/accessibility/{mapId}.vectors.json
 *
 * Usage:
 *   node scripts/import-obstacle-svg.mjs --map=Carentan --svg=tmp/accessibility-mono/Carentan-illustrator.svg
 */
import fs from "node:fs";
import path from "node:path";
import { svgToObstacles } from "./lib/obstacle-svg-import.mjs";
import { mergeOverlappingObstacles } from "../src/features/routeplanner/obstacles/obstacle-boolean.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "data", "accessibility");
const DIST_OUT_DIR = path.join(ROOT, "dist", "data", "accessibility");
const VECTOR_VERSION = 10;

function parseArgs(argv) {
  let mapId = "Carentan";
  let svgPath = "";
  let skipWhite = true;
  for (const arg of argv) {
    if (arg.startsWith("--map=")) mapId = arg.slice(6);
    else if (arg.startsWith("--svg=")) svgPath = arg.slice(6);
    else if (arg === "--include-white") skipWhite = false;
  }
  if (!svgPath) {
    svgPath = path.join(ROOT, "tmp", "accessibility-mono", `${mapId}-illustrator.svg`);
  } else if (!path.isAbsolute(svgPath)) {
    svgPath = path.join(ROOT, svgPath);
  }
  return { mapId, svgPath, skipWhite };
}

function importSvg(svgPath, mapId, { skipWhite }) {
  const svg = fs.readFileSync(svgPath, "utf8");
  const { viewBox, obstacles: rawObstacles, stats, importOptions } = svgToObstacles(svg, { skipWhite, mapId });
  const size = Math.max(viewBox.width, viewBox.height);

  const obstacles = mergeOverlappingObstacles(rawObstacles, { source: "accessibility" }).map((o) => ({
    ...o,
    traceVersion: VECTOR_VERSION,
  }));

  const vertexCounts = obstacles.map((o) => o.points.length);
  return {
    version: VECTOR_VERSION,
    mapId,
    sourceSize: Math.round(size),
    traceMode: "illustrator-import",
    sourceSvg: path.relative(ROOT, svgPath).replace(/\\/g, "/"),
    viewBox: [viewBox.x, viewBox.y, viewBox.width, viewBox.height],
    flattenToleranceSvg: importOptions.flattenTolerance,
    minAreaSvg: importOptions.minAreaSvg,
    obstacleCount: obstacles.length,
    mergeNote: "Overlapping shapes unified via polygon-clipping union",
    obstacles,
    stats: {
      sourceShapes: stats.sourceShapes,
      skippedSmall: stats.skippedSmall,
      mergedFrom: rawObstacles.length,
      vertices: vertexCounts.reduce((sum, n) => sum + n, 0),
      avgVertices: obstacles.length
        ? Math.round((vertexCounts.reduce((sum, n) => sum + n, 0) / obstacles.length) * 10) / 10
        : 0,
      maxVertices: vertexCounts.length ? Math.max(...vertexCounts) : 0,
    },
  };
}

function main() {
  const { mapId, svgPath, skipWhite } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(svgPath)) {
    console.error(`Missing SVG: ${svgPath}`);
    process.exit(1);
  }

  const payload = importSvg(svgPath, mapId, { skipWhite });
  const json = `${JSON.stringify(payload, null, 2)}\n`;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${mapId}.vectors.json`);
  fs.writeFileSync(outPath, json);
  console.log(
    `Wrote ${outPath} [${payload.traceMode}] — ${payload.obstacleCount} shapes, ${payload.stats.vertices} vertices`
  );

  if (fs.existsSync(path.join(ROOT, "dist"))) {
    fs.mkdirSync(DIST_OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(DIST_OUT_DIR, `${mapId}.vectors.json`), json);
    console.log(`Copied to dist/data/accessibility/${mapId}.vectors.json`);
  }
}

main();
