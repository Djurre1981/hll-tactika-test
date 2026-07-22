import { loadEffectiveGrid } from "../obstacles/obstacle-grid.js";
import { findRouteLegPath } from "./route-engine.js";

/**
 * Plan a transport route from start to end on map image coords (0–100).
 */
export async function planRoute(mapId, start, end, obstacles = []) {
  const grid = await loadEffectiveGrid(mapId, obstacles);
  const points = findRouteLegPath(grid, start, end);
  if (!points) {
    return { ok: false, error: "No path found — destination may be blocked." };
  }
  return { ok: true, points };
}

/** @typedef {{ x: number, y: number, user?: boolean }} MapPoint */

/**
 * Ordered via-points that constrain routing (Google Maps / OSRM model).
 * Only explicit user waypoints — never derived from path geometry.
 */
export function getRouteWaypoints(route) {
  if (route?.waypoints?.length >= 2) {
    return route.waypoints.map((p) => ({ x: p.x, y: p.y, user: Boolean(p.user) }));
  }
  // Legacy: auto-simplified "anchors" are collapsed to endpoints only.
  if (route?.anchors?.length >= 2) {
    const a = route.anchors;
    return [
      { x: a[0].x, y: a[0].y, user: Boolean(a[0].user) },
      { x: a[a.length - 1].x, y: a[a.length - 1].y, user: Boolean(a[a.length - 1].user) },
    ];
  }
  if (route?.points?.length >= 2) {
    const p = route.points;
    return [
      { x: p[0].x, y: p[0].y },
      { x: p[p.length - 1].x, y: p[p.length - 1].y },
    ];
  }
  return [];
}

/** Waypoints drawn on the map — destination plus manually inserted vias only. */
export function getVisibleWaypoints(route) {
  const waypoints = getRouteWaypoints(route);
  if (waypoints.length < 2) return [];

  const visible = [];
  for (let i = 1; i < waypoints.length; i += 1) {
    const wp = waypoints[i];
    const isEnd = i === waypoints.length - 1;
    if (isEnd || wp.user) {
      visible.push({
        x: wp.x,
        y: wp.y,
        index: i,
        kind: isEnd ? "end" : "via",
        user: Boolean(wp.user),
      });
    }
  }
  return visible;
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
  next.splice(insertAt, 0, { x: closest.point.x, y: closest.point.y, user: true });
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
 * Each leg is pathfound independently (Google Maps / OSRM via-leg model).
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
    const leg = findRouteLegPath(grid, a, b);
    if (!leg) {
      return { ok: false, error: "Segment blocked — adjust waypoint positions." };
    }
    if (i > 0 && leg.length > 0) leg.shift();
    merged.push(...leg);
  }

  return { ok: true, points: merged, waypoints: waypoints.map((p) => ({ ...p, user: Boolean(p.user) })) };
}

/** @deprecated Use replanThroughWaypoints */
export const replanThroughAnchors = replanThroughWaypoints;
