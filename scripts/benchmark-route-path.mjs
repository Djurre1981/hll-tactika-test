/**
 * Benchmark route pathfinding on Carentan HQ1 → town center.
 * Usage: node scripts/benchmark-route-path.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { applyObstaclesToGrid } from "../src/features/routeplanner/obstacles/obstacle-grid.js";
import { importVectorObstacles } from "../src/features/routeplanner/obstacles/load-accessibility-vectors.js";
import { findGridPath } from "../src/features/routeplanner/path/astar.js";
import { findRouteLegPath } from "../src/features/routeplanner/path/route-engine.js";
import { finalizeRoutePath } from "../src/features/routeplanner/path/smooth-path.js";
import { mapPctToGrid, gridToMapPct, distMapPct } from "../src/features/routeplanner/path/coords.js";
import { validatePath } from "../src/features/routeplanner/path/segment-clearance.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "public/data/accessibility");
const start = { x: 2.42, y: 30.61 };
const end = { x: 47.16, y: 62.49 };

function pathLength(points) {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += distMapPct(points[i - 1], points[i]);
  return d;
}

function loadGrid() {
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

const t0 = performance.now();
const legacyGrid = findGridPath(
  grid,
  mapPctToGrid(start.x, start.y, grid.gridSize),
  mapPctToGrid(end.x, end.y, grid.gridSize)
);
const legacyPts = finalizeRoutePath(
  grid,
  legacyGrid.map(({ gx, gy }) => gridToMapPct(gx, gy, grid.gridSize)),
  { start, end }
);
const legacyMs = performance.now() - t0;

const t1 = performance.now();
const newPts = findRouteLegPath(grid, start, end);
const newMs = performance.now() - t1;

function report(label, pts, ms) {
  console.log(
    `${label}: ${pts.length} pts, ${pathLength(pts).toFixed(2)} map-units, valid=${validatePath(grid, pts)}, ${ms.toFixed(1)}ms`
  );
}

report("Grid A* + finalize (legacy)", legacyPts, legacyMs);
report("Two-phase engine (A* + string-pull)", newPts, newMs);
