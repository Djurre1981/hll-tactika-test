/**
 * Merge overlapping vector obstacles into unified polygons (boolean union).
 *
 * Usage:
 *   node scripts/merge-vector-obstacles.mjs --map=Carentan
 *   node scripts/merge-vector-obstacles.mjs --map=Carentan --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { mergeOverlappingObstacles } from "../src/features/routeplanner/obstacles/obstacle-boolean.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "data", "accessibility");

function parseArgs(argv) {
  let mapId = null;
  let dryRun = false;
  for (const arg of argv) {
    if (arg.startsWith("--map=")) mapId = arg.slice(6);
    else if (arg === "--dry-run") dryRun = true;
  }
  if (!mapId) {
    console.error("Usage: node scripts/merge-vector-obstacles.mjs --map=Carentan [--dry-run]");
    process.exit(1);
  }
  return { mapId, dryRun };
}

function statsForObstacles(obstacles) {
  let vertices = 0;
  let maxVertices = 0;
  for (const o of obstacles) {
    const n = o.points?.length || 0;
    vertices += n;
    if (n > maxVertices) maxVertices = n;
  }
  return {
    vertices,
    avgVertices: obstacles.length ? Math.round((vertices / obstacles.length) * 10) / 10 : 0,
    maxVertices,
  };
}

function main() {
  const { mapId, dryRun } = parseArgs(process.argv.slice(2));
  const file = path.join(OUT_DIR, `${mapId}.vectors.json`);
  if (!fs.existsSync(file)) {
    console.error(`Missing ${file}`);
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const before = payload.obstacles || [];
  const merged = mergeOverlappingObstacles(before, { source: payload.obstacles?.[0]?.source || "accessibility" })
    .map((o) => ({
      ...o,
      traceVersion: 10,
    }));
  const mergedStats = statsForObstacles(merged);

  console.log(`${mapId}: ${before.length} → ${merged.length} obstacles`);
  console.log(
    `  vertices: ${payload.stats?.vertices ?? "?"} → ${mergedStats.vertices} (max ${mergedStats.maxVertices})`
  );

  if (dryRun) {
    console.log("Dry run — file not written.");
    return;
  }

  const next = {
    ...payload,
    version: 10,
    obstacleCount: merged.length,
    mergedAt: new Date().toISOString(),
    mergeNote: "Overlapping block polygons unified via polygon-clipping union",
    stats: {
      ...payload.stats,
      ...mergedStats,
      mergedFrom: before.length,
    },
    obstacles: merged,
  };

  fs.writeFileSync(file, `${JSON.stringify(next)}\n`, "utf8");
  console.log(`Wrote ${file}`);
}

main();
