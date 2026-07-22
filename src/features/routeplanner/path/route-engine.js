import { mapPctToGrid, gridToMapPct } from "./coords.js";
import { findGridPath } from "./astar.js";
import { stringPullPath } from "./string-pull.js";
import { segmentClear, validatePath } from "./segment-clearance.js";

function gridPathToMapPct(grid, gridPath) {
  return gridPath.map(({ gx, gy }) => gridToMapPct(gx, gy, grid.gridSize));
}

function applyExactEndpoints(grid, points, { start, end } = {}) {
  if (!points.length) return points;
  const out = points.map((p) => ({ ...p }));

  if (start) {
    if (out.length >= 2 && segmentClear(grid, start, out[1])) {
      out[0] = { ...start };
    } else if (out.length === 1 || segmentClear(grid, start, out[0])) {
      out[0] = { ...start };
    }
  }

  if (end && out.length >= 2) {
    const prev = out[out.length - 2];
    if (segmentClear(grid, prev, end)) {
      out[out.length - 1] = { ...end };
    }
  }

  return out;
}

/**
 * Find the shortest obstacle-compliant path for one route leg.
 *
 * Two-phase pipeline (same separation as OSRM/Valhalla: route search → geometry):
 *   1. Grid A* — fast corridor search on clearance field
 *   2. String-pull — minimal polyline with sub-cell clearance validation
 *   3. Endpoint snap — exact HQ / click coords when segment is clear
 */
export function findRouteLegPath(grid, start, end) {
  const gridStart = mapPctToGrid(start.x, start.y, grid.gridSize);
  const gridEnd = mapPctToGrid(end.x, end.y, grid.gridSize);

  const gridPath = findGridPath(grid, gridStart, gridEnd);
  if (!gridPath) return null;

  const mapPoints = gridPathToMapPct(grid, gridPath);
  let pulled = stringPullPath(grid, mapPoints);
  pulled = applyExactEndpoints(grid, pulled, { start, end });

  if (validatePath(grid, pulled)) return pulled;

  const pulledGrid = stringPullPath(grid, mapPoints);
  if (validatePath(grid, pulledGrid)) return pulledGrid;

  if (validatePath(grid, mapPoints)) return mapPoints.map((p) => ({ ...p }));

  return mapPoints.map((p) => ({ ...p }));
}
