import { segmentClear } from "./segment-clearance.js";

/**
 * String-pull / SSFA-style simplification: keep the farthest visible point from
 * each anchor (same family as post-processors in OSRM/Valhalla geometry pipelines).
 */
export function stringPullPath(grid, points) {
  if (!points?.length) return [];
  if (points.length <= 2) return points.map((p) => ({ ...p }));

  const out = [{ ...points[0] }];
  let anchor = 0;

  while (anchor < points.length - 1) {
    let farthest = anchor + 1;
    for (let i = points.length - 1; i > anchor; i -= 1) {
      if (segmentClear(grid, points[anchor], points[i])) {
        farthest = i;
        break;
      }
    }
    if (!segmentClear(grid, points[anchor], points[farthest])) {
      farthest = anchor + 1;
    }
    out.push({ ...points[farthest] });
    anchor = farthest;
  }

  return out;
}
