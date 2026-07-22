import { loadAccessibilityGrid } from "../path/accessibility-grid.js";
import { MAP_PCT_MAX, MAP_PCT_MIN } from "../constants.js";
import { pointInObstacle } from "./obstacle-shapes.js";
import { getTransportBodyWidthMapPct } from "../path/vehicle-clearance.js";

/** Native pathfinding resolution — matches extract-accessibility.mjs GRID. */
export const PATHFIND_GRID_SIZE = 384;

const effectiveCache = new Map();

function obstaclesKey(obstacles) {
  if (!obstacles?.length) return "";
  return obstacles
    .map(
      (o) =>
        `${o.id}:${o.source || ""}:${o.type}:${o.effect}:${o.points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("|")}${o.holes?.length ? `:h${o.holes.map((ring) => ring.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("|")).join(";")}` : ""}`
    )
    .join(";");
}

function mapPctToPathGrid(x, y, gridSize) {
  const span = MAP_PCT_MAX - MAP_PCT_MIN;
  const gx = Math.floor(((x - MAP_PCT_MIN) / span) * gridSize);
  const gy = Math.floor(((y - MAP_PCT_MIN) / span) * gridSize);
  return {
    gx: Math.min(gridSize - 1, Math.max(0, gx)),
    gy: Math.min(gridSize - 1, Math.max(0, gy)),
  };
}

function gridCellCenterMapPct(gx, gy, gridSize) {
  const span = MAP_PCT_MAX - MAP_PCT_MIN;
  return {
    x: MAP_PCT_MIN + ((gx + 0.5) / gridSize) * span,
    y: MAP_PCT_MIN + ((gy + 0.5) / gridSize) * span,
  };
}

function cellInRect(gx, gy, gx1, gy1, gx2, gy2) {
  return gx >= gx1 && gx <= gx2 && gy >= gy1 && gy <= gy2;
}

function cellInEllipse(gx, gy, gx1, gy1, gx2, gy2) {
  const cx = (gx1 + gx2) / 2;
  const cy = (gy1 + gy2) / 2;
  const rx = Math.max(0.5, (gx2 - gx1) / 2);
  const ry = Math.max(0.5, (gy2 - gy1) / 2);
  const nx = (gx - cx) / rx;
  const ny = (gy - cy) / ry;
  return nx * nx + ny * ny <= 1;
}

function cellInsideObstacle(gx, gy, size, obstacle) {
  if (obstacle.type === "polygon") {
    return pointInObstacle(gridCellCenterMapPct(gx, gy, size), obstacle);
  }

  const xs = obstacle.points.map((p) => mapPctToPathGrid(p.x, p.y, size).gx);
  const ys = obstacle.points.map((p) => mapPctToPathGrid(p.x, p.y, size).gy);
  const gx1 = Math.max(0, Math.min(...xs));
  const gy1 = Math.max(0, Math.min(...ys));
  const gx2 = Math.min(size - 1, Math.max(...xs));
  const gy2 = Math.min(size - 1, Math.max(...ys));

  if (obstacle.type === "ellipse") {
    return cellInEllipse(gx, gy, gx1, gy1, gx2, gy2);
  }
  return cellInRect(gx, gy, gx1, gy1, gx2, gy2);
}

function rasterizeObstacle(blocked, size, obstacle, value) {
  if (!obstacle?.points?.length || obstacle.points.length < 2) return;

  const xs = obstacle.points.map((p) => mapPctToPathGrid(p.x, p.y, size).gx);
  const ys = obstacle.points.map((p) => mapPctToPathGrid(p.x, p.y, size).gy);
  const gx1 = Math.max(0, Math.min(...xs));
  const gy1 = Math.max(0, Math.min(...ys));
  const gx2 = Math.min(size - 1, Math.max(...xs));
  const gy2 = Math.min(size - 1, Math.max(...ys));

  for (let gy = gy1; gy <= gy2; gy++) {
    for (let gx = gx1; gx <= gx2; gx++) {
      if (!cellInsideObstacle(gx, gy, size, obstacle)) continue;
      blocked[gy * size + gx] = value;
    }
  }
}

function upsampleBlocked(baseBlocked, baseSize, targetSize) {
  const out = new Uint8Array(targetSize * targetSize);
  for (let gy = 0; gy < targetSize; gy += 1) {
    for (let gx = 0; gx < targetSize; gx += 1) {
      const bx = Math.min(baseSize - 1, Math.floor((gx / targetSize) * baseSize));
      const by = Math.min(baseSize - 1, Math.floor((gy / targetSize) * baseSize));
      if (baseBlocked[by * baseSize + bx]) out[gy * targetSize + gx] = 1;
    }
  }
  return out;
}

function normalizeBaseBlocked(baseGrid, targetSize) {
  if (baseGrid.gridSize === targetSize) {
    return baseGrid.blocked instanceof Uint8Array
      ? new Uint8Array(baseGrid.blocked)
      : Uint8Array.from(baseGrid.blocked);
  }
  return upsampleBlocked(baseGrid.blocked, baseGrid.gridSize, targetSize);
}

/** Apply vector obstacles onto the pathfinding grid (raw — truck width checked at query time). */
export function applyObstaclesToGrid(baseGrid, obstacles = []) {
  const gridSize = PATHFIND_GRID_SIZE;
  const blocked = normalizeBaseBlocked(baseGrid, gridSize);

  if (obstacles?.length) {
    for (const obstacle of obstacles) {
      if (obstacle.effect === "clear") continue;
      rasterizeObstacle(blocked, gridSize, obstacle, 1);
    }
    for (const obstacle of obstacles) {
      if (obstacle.effect !== "clear") continue;
      rasterizeObstacle(blocked, gridSize, obstacle, 0);
    }
  }

  return {
    blocked,
    gridSize,
    vehicleWidthMapPct: getTransportBodyWidthMapPct(),
  };
}

export async function loadEffectiveGrid(mapId, obstacles = []) {
  const base = await loadAccessibilityGrid(mapId);
  const oKey = obstaclesKey(obstacles);
  const widthKey = getTransportBodyWidthMapPct().toFixed(4);
  const cacheKey = `${mapId}:${PATHFIND_GRID_SIZE}:w${widthKey}:${oKey}`;
  if (effectiveCache.has(cacheKey)) return effectiveCache.get(cacheKey);

  const applied = applyObstaclesToGrid(base, obstacles);
  const grid = {
    ...base,
    blocked: applied.blocked,
    gridSize: applied.gridSize,
    vehicleWidthMapPct: applied.vehicleWidthMapPct,
    obstacles: obstacles || [],
  };
  effectiveCache.set(cacheKey, grid);

  for (const key of effectiveCache.keys()) {
    if (key.startsWith(`${mapId}:`) && key !== cacheKey) effectiveCache.delete(key);
  }

  return grid;
}

export function clearEffectiveGridCache() {
  effectiveCache.clear();
}
