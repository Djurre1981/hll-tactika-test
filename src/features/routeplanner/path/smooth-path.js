/** @deprecated Import from segment-clearance.js */
export { segmentClear as segmentClearOnGrid, validatePath as validatePathAgainstGrid } from "./segment-clearance.js";

/** @deprecated Import from string-pull.js */
export { stringPullPath as simplifyLineOfSight } from "./string-pull.js";

import { stringPullPath } from "./string-pull.js";
import { segmentClear, validatePath } from "./segment-clearance.js";

function applyExactEndpoints(grid, los, { start, end } = {}) {
  const out = los.map((p) => ({ ...p }));

  if (start && out.length >= 2 && segmentClear(grid, start, out[1])) {
    out[0] = { ...start };
  } else if (start && out.length === 1) {
    out[0] = { ...start };
  }

  if (end && out.length >= 2) {
    const prev = out[out.length - 2];
    if (segmentClear(grid, prev, end)) {
      out[out.length - 1] = { ...end };
    }
  }

  return out;
}

/** @deprecated Use findRouteLegPath from route-engine.js */
export function finalizeRoutePath(grid, gridPathPoints, { start, end } = {}) {
  if (!gridPathPoints?.length) return [];
  if (gridPathPoints.length === 1) {
    if (start) return [{ ...start }];
    return [{ ...gridPathPoints[0] }];
  }

  const pulled = stringPullPath(grid, gridPathPoints);
  const withEndpoints = applyExactEndpoints(grid, pulled, { start, end });
  if (validatePath(grid, withEndpoints)) return withEndpoints;

  const pulledGrid = stringPullPath(grid, gridPathPoints);
  if (validatePath(grid, pulledGrid)) return pulledGrid;

  return gridPathPoints.map((p) => ({ ...p }));
}

/** @deprecated Smoothing removed — it caused paths to cut through obstacles. */
export function smoothPath(points) {
  return points.map((p) => ({ ...p }));
}

/** @deprecated Use stringPullPath instead. */
export function simplifyCollinear(points) {
  return points.map((p) => ({ ...p }));
}
