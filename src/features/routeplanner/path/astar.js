import { isVehicleCellBlocked } from "./vehicle-clearance.js";

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function key(gx, gy) {
  return `${gx},${gy}`;
}

function heuristic(a, b) {
  return Math.hypot(b.gx - a.gx, b.gy - a.gy);
}

/** BFS outward to the nearest cell where a truck fits (handles HQ/clicks on edges). */
export function snapToNearestFree(grid, point, maxRadius = 18) {
  const size = grid.gridSize;
  const { gx, gy } = point;
  if (!isVehicleCellBlocked(grid, gx, gy)) return point;

  const queue = [{ gx, gy, d: 0 }];
  const seen = new Set([key(gx, gy)]);

  while (queue.length) {
    const { gx: cx, gy: cy, d } = queue.shift();
    if (d > maxRadius) break;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const nk = key(nx, ny);
      if (seen.has(nk)) continue;
      seen.add(nk);
      if (!isVehicleCellBlocked(grid, nx, ny)) return { gx: nx, gy: ny };
      queue.push({ gx: nx, gy: ny, d: d + 1 });
    }
  }

  return null;
}

/**
 * A* on accessibility grid with truck-width clearance at each cell.
 */
export function findGridPath(grid, start, end) {
  const size = grid.gridSize;
  const resolvedStart = snapToNearestFree(grid, start);
  const resolvedEnd = snapToNearestFree(grid, end);
  if (!resolvedStart || !resolvedEnd) return null;

  const open = new Map();
  const cameFrom = new Map();
  const gScore = new Map();

  const startKey = key(resolvedStart.gx, resolvedStart.gy);
  const endKey = key(resolvedEnd.gx, resolvedEnd.gy);
  gScore.set(startKey, 0);
  open.set(startKey, heuristic(resolvedStart, resolvedEnd));

  while (open.size > 0) {
    let currentKey = null;
    let best = Infinity;
    for (const [k, f] of open) {
      if (f < best) {
        best = f;
        currentKey = k;
      }
    }
    if (currentKey === endKey) {
      const path = [];
      let ck = currentKey;
      while (ck) {
        const [gx, gy] = ck.split(",").map(Number);
        path.push({ gx, gy });
        ck = cameFrom.get(ck);
      }
      return path.reverse();
    }

    open.delete(currentKey);
    const [cx, cy] = currentKey.split(",").map(Number);
    const baseG = gScore.get(currentKey) ?? Infinity;

    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      if (isVehicleCellBlocked(grid, nx, ny)) continue;
      if (dx !== 0 && dy !== 0) {
        if (isVehicleCellBlocked(grid, cx + dx, cy) || isVehicleCellBlocked(grid, cx, cy + dy)) {
          continue;
        }
      }
      const nk = key(nx, ny);
      const step = dx !== 0 && dy !== 0 ? 1.414 : 1;
      const tentative = baseG + step;
      if (tentative >= (gScore.get(nk) ?? Infinity)) continue;
      cameFrom.set(nk, currentKey);
      gScore.set(nk, tentative);
      open.set(nk, tentative + heuristic({ gx: nx, gy: ny }, resolvedEnd));
    }
  }

  return null;
}
