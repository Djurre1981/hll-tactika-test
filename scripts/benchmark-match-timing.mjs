/**
 * Benchmark frontier-wall match timing on Carentan US HQ1 → town center.
 * Usage: node scripts/benchmark-match-timing.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { computeRouteTiming, formatMatchTime } from "../src/features/routeplanner/timing/route-timing.js";
import { findRouteLegPath } from "../src/features/routeplanner/path/route-engine.js";
import { applyObstaclesToGrid } from "../src/features/routeplanner/obstacles/obstacle-grid.js";
import { importVectorObstacles } from "../src/features/routeplanner/obstacles/load-accessibility-vectors.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const start = { x: 2.42, y: 30.61 };
const end = { x: 47.16, y: 62.49 };
const hqSide = "left";
/** Ford transport theoretical max from vehicles.json (avoid @map-kernel in Node). */
const SPEED_KMH = 38.5;

function loadGrid() {
  const dataDir = join(root, "public/data/accessibility");
  const baseData = JSON.parse(readFileSync(join(dataDir, "Carentan.json"), "utf8"));
  const blocked = new Uint8Array(baseData.gridSize * baseData.gridSize);
  for (let i = 0; i < baseData.blocked.length; i++) {
    blocked[i] = baseData.blocked[i] === "1" ? 1 : 0;
  }
  const base = { ...baseData, blocked };
  const vectors = JSON.parse(readFileSync(join(dataDir, "Carentan.vectors.json"), "utf8"));
  const obstacles = importVectorObstacles(vectors);
  const applied = applyObstaclesToGrid(base, obstacles);
  return { ...base, blocked: applied.blocked, gridSize: applied.gridSize, obstacles };
}

const grid = loadGrid();
const points = findRouteLegPath(grid, start, end);
const speed = SPEED_KMH;
const timing = computeRouteTiming(points, speed, hqSide);

console.log("Carentan US HQ1 → town center");
console.log(`  points: ${points.length}`);
console.log(`  speed: ${speed.toFixed(1)} km/h`);
console.log(`  drive: ${timing.travelTimeSec.toFixed(1)}s`);
console.log(`  wall wait: ${timing.wallWaitSec.toFixed(1)}s`);
console.log(`  match arrival: ${formatMatchTime(timing.matchArrivalSec)} (${timing.matchArrivalSec.toFixed(1)}s)`);

let failed = false;
if (timing.wallWaitSec <= 0) {
  console.error("FAIL: expected wall wait > 0 for route crossing frontier");
  failed = true;
}
if (timing.matchArrivalSec <= timing.travelTimeSec) {
  console.error("FAIL: match arrival should exceed drive time when wall wait applies");
  failed = true;
}
if (timing.matchArrivalSec < 120) {
  console.error("FAIL: match arrival should be at least 120s when wall blocks early crossing");
  failed = true;
}

if (failed) process.exit(1);
console.log("OK");
