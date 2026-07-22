import { mapPctToGrid, gridToMapPct } from "./coords.js";
import { loadEffectiveGrid } from "../obstacles/obstacle-grid.js";
import { findGridPath } from "./astar.js";
import { finalizeRoutePath } from "./smooth-path.js";

/**
 * Plan a transport route from start to end on map image coords (0–100).
 */
export async function planRoute(mapId, start, end, obstacles = []) {
  const grid = await loadEffectiveGrid(mapId, obstacles);
  const gridStart = mapPctToGrid(start.x, start.y, grid.gridSize);
  const gridEnd = mapPctToGrid(end.x, end.y, grid.gridSize);

  const path = findGridPath(grid, gridStart, gridEnd);
  if (!path) {
    return { ok: false, error: "No path found — destination may be blocked." };
  }

  const mapPoints = path.map(({ gx, gy }) => gridToMapPct(gx, gy, grid.gridSize));
  mapPoints[0] = { ...start };
  mapPoints[mapPoints.length - 1] = { ...end };

  const points = finalizeRoutePath(grid, mapPoints);
  return { ok: true, points };
}

/** @typedef {{ x: number, y: number }} MapPoint */

/**
 * Ordered via-points that constrain routing (Google Maps / OSRM model).
 * Only explicit user waypoints — never derived from path geometry.
 */
export function getRouteWaypoints(route) {
  if (route?.waypoints?.length >= 2) {
    return route.waypoints.map((p) => ({ x: p.x, y: p.y }));
  }
  // Legacy: auto-simplified "anchors" are collapsed to endpoints only.
  if (route?.anchors?.length >= 2) {
    const a = route.anchors;
    return [{ x: a[0].x, y: a[0].y }, { x: a[a.length - 1].x, y: a[a.length - 1].y }];
  }
  if (route?.points?.length >= 2) {
    const p = route.points;
    return [{ x: p[0].x, y: p[0].y }, { x: p[p.length - 1].x, y: p[p.length - 1].y }];
  }
  return [];
}

export function pointToSegmentDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function projectPointOnSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: a.x, y: a.y };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function pathIndexNearestPoint(points, target) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = Math.hypot(points[i].x - target.x, points[i].y - target.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Closest point on the displayed route polyline to a map click. */
export function closestPointOnPath(pathPoints, click) {
  if (!pathPoints?.length || pathPoints.length < 2) return null;

  let bestDist = Infinity;
  let bestPoint = null;
  let bestSegment = 0;

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const projected = projectPointOnSegment(click, pathPoints[i], pathPoints[i + 1]);
    const d = Math.hypot(click.x - projected.x, click.y - projected.y);
    if (d < bestDist) {
      bestDist = d;
      bestPoint = projected;
      bestSegment = i;
    }
  }

  return { point: bestPoint, distance: bestDist, segmentIndex: bestSegment };
}

function isNearExistingWaypoint(click, waypoints, threshold) {
  return waypoints.some(
    (w) => Math.hypot(click.x - w.x, click.y - w.y) < threshold
  );
}

/**
 * Insert a waypoint where the user clicked on the route polyline.
 * Returns null when the click is off-route or too close to an existing waypoint.
 */
export function insertWaypointOnPath(
  waypoints,
  pathPoints,
  click,
  { hitThreshold = 2.5, waypointThreshold = 2.0 } = {}
) {
  if (!waypoints?.length || waypoints.length < 2 || !pathPoints?.length) return null;

  const closest = closestPointOnPath(pathPoints, click);
  if (!closest?.point || closest.distance > hitThreshold) return null;
  if (isNearExistingWaypoint(click, waypoints, waypointThreshold)) return null;

  const pathIndices = waypoints.map((w) => pathIndexNearestPoint(pathPoints, w));
  let insertAt = 1;
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (
      closest.segmentIndex >= pathIndices[i] &&
      closest.segmentIndex <= pathIndices[i + 1]
    ) {
      insertAt = i + 1;
      break;
    }
  }

  const next = waypoints.map((p) => ({ ...p }));
  next.splice(insertAt, 0, { x: closest.point.x, y: closest.point.y });
  return { waypoints: next, insertIndex: insertAt };
}

/**
 * Insert a user waypoint on the leg closest to `click` (route-line drag model).
 */
export function insertWaypoint(waypoints, click) {
  if (!waypoints?.length) return [{ ...click }];
  if (waypoints.length < 2) return [...waypoints.map((p) => ({ ...p })), { ...click }];

  let insertAt = 1;
  let best = Infinity;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const d = pointToSegmentDistance(click, waypoints[i], waypoints[i + 1]);
    if (d < best) {
      best = d;
      insertAt = i + 1;
    }
  }

  const next = waypoints.map((p) => ({ ...p }));
  next.splice(insertAt, 0, { x: click.x, y: click.y });
  return next;
}

/** Remove a via-waypoint (not start/end). Returns null if index invalid. */
export function removeWaypoint(waypoints, index) {
  if (!waypoints || index <= 0 || index >= waypoints.length - 1) return null;
  return waypoints.filter((_, i) => i !== index);
}

/**
 * Recompute path through ordered waypoints (origin → vias → destination).
 * Each leg is pathfound and smoothed independently, then concatenated.
 */
export async function replanThroughWaypoints(mapId, waypoints, obstacles = []) {
  if (!waypoints || waypoints.length < 2) {
    return { ok: false, error: "Route needs at least start and end." };
  }

  const grid = await loadEffectiveGrid(mapId, obstacles);
  const merged = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const gridStart = mapPctToGrid(a.x, a.y, grid.gridSize);
    const gridEnd = mapPctToGrid(b.x, b.y, grid.gridSize);
    const segment = findGridPath(grid, gridStart, gridEnd);
    if (!segment) {
      return { ok: false, error: "Segment blocked — adjust waypoint positions." };
    }

    const segmentPoints = segment.map(({ gx, gy }) => gridToMapPct(gx, gy, grid.gridSize));
    segmentPoints[0] = { ...a };
    segmentPoints[segmentPoints.length - 1] = { ...b };

    const finalized = finalizeRoutePath(grid, segmentPoints);
    if (i > 0 && finalized.length > 0) finalized.shift();
    merged.push(...finalized);
  }

  if (merged.length >= 1) {
    merged[0] = { ...waypoints[0] };
    merged[merged.length - 1] = { ...waypoints[waypoints.length - 1] };
  }

  return { ok: true, points: merged, waypoints: waypoints.map((p) => ({ ...p })) };
}

/** @deprecated Use replanThroughWaypoints */
export const replanThroughAnchors = replanThroughWaypoints;
