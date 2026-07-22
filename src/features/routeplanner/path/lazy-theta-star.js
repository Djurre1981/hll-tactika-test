import { segmentCrossesBlocked } from "./accessibility-grid.js";
import { isVehicleCellBlocked } from "./vehicle-clearance.js";
import { gridToMapPct } from "./coords.js";
import { segmentClear } from "./segment-clearance.js";
import { snapToNearestFree } from "./astar.js";

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

function gridCellMapPct(grid, gx, gy) {
  return gridToMapPct(gx, gy, grid.gridSize);
}

function gridLineClear(grid, a, b) {
  return !segmentCrossesBlocked(grid, a, b, 0.25);
}

/** Finer clearance for final leg validation only. */
export function gridLineClearMapPct(grid, a, b) {
  return segmentClear(
    grid,
    gridCellMapPct(grid, a.gx, a.gy),
    gridCellMapPct(grid, b.gx, b.gy)
  );
}

function gridDist(a, b) {
  return Math.hypot(b.gx - a.gx, b.gy - a.gy);
}

/** Binary min-heap for open set (key → fScore). */
class MinHeap {
  constructor() {
    this.keys = [];
    this.priorities = [];
  }

  get size() {
    return this.keys.length;
  }

  push(key, priority) {
    this.keys.push(key);
    this.priorities.push(priority);
    this.#bubbleUp(this.keys.length - 1);
  }

  pop() {
    if (this.keys.length === 0) return null;
    const key = this.keys[0];
    const last = this.keys.length - 1;
    if (last === 0) {
      this.keys.pop();
      this.priorities.pop();
      return key;
    }
    this.keys[0] = this.keys[last];
    this.priorities[0] = this.priorities[last];
    this.keys.pop();
    this.priorities.pop();
    this.#sinkDown(0);
    return key;
  }

  #bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.priorities[parent] <= this.priorities[i]) break;
      this.#swap(i, parent);
      i = parent;
    }
  }

  #sinkDown(i) {
    const n = this.keys.length;
    while (true) {
      const left = i * 2 + 1;
      const right = left + 1;
      let smallest = i;
      if (left < n && this.priorities[left] < this.priorities[smallest]) smallest = left;
      if (right < n && this.priorities[right] < this.priorities[smallest]) smallest = right;
      if (smallest === i) break;
      this.#swap(i, smallest);
      i = smallest;
    }
  }

  #swap(a, b) {
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    [this.priorities[a], this.priorities[b]] = [this.priorities[b], this.priorities[a]];
  }
}

/**
 * Lazy Theta* — any-angle shortest path on a clearance grid.
 * @see Nash & Koenig, "Any-angle path planning on grids"
 * Returns grid cell path or null.
 */
export function findThetaStarPath(grid, start, end) {
  const size = grid.gridSize;
  const resolvedStart = snapToNearestFree(grid, start);
  const resolvedEnd = snapToNearestFree(grid, end);
  if (!resolvedStart || !resolvedEnd) return null;

  const open = new MinHeap();
  const openMap = new Map();
  const gScore = new Map();
  const parent = new Map();

  const startKey = key(resolvedStart.gx, resolvedStart.gy);
  const endKey = key(resolvedEnd.gx, resolvedEnd.gy);

  parent.set(startKey, startKey);
  gScore.set(startKey, 0);
  const startF = heuristic(resolvedStart, resolvedEnd);
  open.push(startKey, startF);
  openMap.set(startKey, startF);

  while (open.size > 0) {
    const currentKey = open.pop();
    openMap.delete(currentKey);
    if (!currentKey) break;

    if (currentKey === endKey) {
      const path = [];
      let ck = currentKey;
      while (ck) {
        const [gx, gy] = ck.split(",").map(Number);
        path.push({ gx, gy });
        if (ck === parent.get(ck)) break;
        ck = parent.get(ck);
      }
      return path.reverse();
    }

    const [cx, cy] = currentKey.split(",").map(Number);
    const current = { gx: cx, gy: cy };
    const parentKey = parent.get(currentKey);
    const [px, py] = parentKey.split(",").map(Number);
    const gridParent = { gx: px, gy: py };
    const baseG = gScore.get(currentKey) ?? Infinity;

    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      if (isVehicleCellBlocked(grid, nx, ny)) continue;
      if (dx !== 0 && dy !== 0) {
        if (isVehicleCellBlocked(grid, cx + dx, cy) || isVehicleCellBlocked(grid, cx, cy + dy)) continue;
      }

      const neighbor = { gx: nx, gy: ny };
      const nk = key(nx, ny);

      let newParentKey = currentKey;
      let tentativeG = baseG + gridDist(current, neighbor);

      if (gridLineClear(grid, gridParent, neighbor)) {
        const viaParentG = (gScore.get(parentKey) ?? Infinity) + gridDist(gridParent, neighbor);
        if (viaParentG < tentativeG) {
          tentativeG = viaParentG;
          newParentKey = parentKey;
        }
      }

      if (tentativeG >= (gScore.get(nk) ?? Infinity)) continue;

      parent.set(nk, newParentKey);
      gScore.set(nk, tentativeG);
      const f = tentativeG + heuristic(neighbor, resolvedEnd);
      open.push(nk, f);
      openMap.set(nk, f);
    }
  }

  return null;
}
