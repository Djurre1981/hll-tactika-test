import { mapPctToGrid } from "./coords.js";
import { isBlocked, segmentCrossesBlocked } from "./accessibility-grid.js";

/** Chaikin corner-cutting for shallow curves. */
export function smoothPath(points, iterations = 2) {
  if (points.length < 3) return points.slice();
  let current = points.slice();
  for (let iter = 0; iter < iterations; iter++) {
    const next = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const p0 = current[i];
      const p1 = current[i + 1];
      next.push(
        { x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 },
        { x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 }
      );
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

export function simplifyCollinear(points, epsilon = 0.35) {
  if (points.length <= 2) return points.slice();
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1];
    const curr = points[i];
    const next = points[i + 1];
    const cross = Math.abs(
      (curr.x - prev.x) * (next.y - prev.y) - (curr.y - prev.y) * (next.x - prev.x)
    );
    if (cross > epsilon) out.push(curr);
  }
  out.push(points[points.length - 1]);
  return out;
}

export function validatePathAgainstGrid(grid, points) {
  for (let i = 1; i < points.length; i++) {
    const a = mapPctToGrid(points[i - 1].x, points[i - 1].y, grid.gridSize);
    const b = mapPctToGrid(points[i].x, points[i].y, grid.gridSize);
    if (segmentCrossesBlocked(grid, a, b)) return false;
  }
  return true;
}

export function densifyPath(points, maxSegmentPct = 2.5) {
  if (points.length < 2) return points.slice();
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(len / maxSegmentPct));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      });
    }
  }
  return out;
}

/** If smoothed path crosses obstacles, fall back to simplified grid path. */
export function finalizeRoutePath(grid, gridPathPoints) {
  const simplified = simplifyCollinear(gridPathPoints);
  let candidate = smoothPath(simplified, 2);
  candidate = densifyPath(candidate, 2);
  if (validatePathAgainstGrid(grid, candidate)) return candidate;
  return densifyPath(simplified, 1.5);
}
