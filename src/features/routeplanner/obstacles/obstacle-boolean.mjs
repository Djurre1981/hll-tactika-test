import polygonClipping from "polygon-clipping";
import { clampPoint, bboxFromPoints, pointInPolygon } from "./obstacle-shapes.js";

function pctToRing(points) {
  if (!points?.length) return [];
  const ring = points.map((p) => [p.x, p.y]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  return ring;
}

function ringToPoints(ring) {
  if (!ring?.length) return [];
  const open =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;
  return open.map(([x, y]) => clampPoint({ x, y }));
}

function bboxOverlap(a, b) {
  return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
}

function asPolygon(points) {
  const ring = pctToRing(points);
  return ring.length >= 4 ? [[ring]] : null;
}

function obstacleToClippingPoly(obstacle) {
  if (obstacle.type !== "polygon" || obstacle.points.length < 3) return null;
  const rings = [pctToRing(obstacle.points)];
  for (const hole of obstacle.holes || []) {
    const ring = pctToRing(hole);
    if (ring.length >= 4) rings.push(ring);
  }
  return rings[0]?.length >= 4 ? [rings] : null;
}

function pointsFromObstacle(obstacle) {
  return obstacle.type === "polygon" && obstacle.points.length >= 3
    ? obstacle.points
    : null;
}

/** True when two polygons share area (not just touching edges). */
export function polygonsOverlap(aPoints, bPoints) {
  const a = asPolygon(aPoints);
  const b = asPolygon(bPoints);
  if (!a || !b) return false;
  const boxA = bboxFromPoints(aPoints);
  const boxB = bboxFromPoints(bPoints);
  if (!bboxOverlap(boxA, boxB)) return false;
  try {
    const hit = polygonClipping.intersection(a, b);
    return Boolean(hit?.length);
  } catch {
    return false;
  }
}

function polygonCentroid(points) {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

/** True when boolean union should combine two block shapes into one. */
export function polygonsShouldMerge(aPoints, bPoints) {
  if (polygonsOverlap(aPoints, bPoints)) return true;

  const a = asPolygon(aPoints);
  const b = asPolygon(bPoints);
  if (!a || !b) return false;

  const boxA = bboxFromPoints(aPoints);
  const boxB = bboxFromPoints(bPoints);
  if (!bboxOverlap(boxA, boxB)) return false;

  const ca = polygonCentroid(aPoints);
  const cb = polygonCentroid(bPoints);
  if (pointInPolygon(ca, bPoints) || pointInPolygon(cb, aPoints)) return true;

  try {
    return polygonClipping.union(a, b).length === 1;
  } catch {
    return false;
  }
}

function multipolygonToObstacleParts(multi, { effect, source = "layer" }) {
  const parts = [];
  for (const poly of multi) {
    if (!poly?.[0] || poly[0].length < 4) continue;
    const holes = [];
    for (let h = 1; h < poly.length; h += 1) {
      if (!poly[h] || poly[h].length < 4) continue;
      holes.push(ringToPoints(poly[h]));
    }
    parts.push({
      id: `obs-${crypto.randomUUID()}`,
      type: "polygon",
      effect,
      source,
      points: ringToPoints(poly[0]),
      ...(holes.length ? { holes } : {}),
    });
  }
  return parts;
}

/** Union a new polygon with all overlapping block obstacles; returns full obstacle list. */
export function applyPenAddUnion(obstacles, newPoints) {
  const poly = asPolygon(newPoints);
  if (!poly) return obstacles;

  const blockObstacles = obstacles.filter((o) => o.effect === "block");
  const overlapping = blockObstacles.filter((o) => {
    const pts = pointsFromObstacle(o);
    if (!pts) return false;
    return polygonsOverlap(pts, newPoints);
  });

  if (!overlapping.length) {
    const created = multipolygonToObstacleParts([poly[0]], { effect: "block" });
    return created.length ? [...obstacles, created[0]] : obstacles;
  }

  let merged = poly;
  for (const obstacle of overlapping) {
    const other = obstacleToClippingPoly(obstacle);
    if (!other) continue;
    try {
      merged = polygonClipping.union(merged, other);
    } catch {
      /* skip invalid ring */
    }
  }

  const mergedParts = multipolygonToObstacleParts(merged, { effect: "block", source: "layer" });
  if (!mergedParts.length) return obstacles;

  const removeIds = new Set(overlapping.map((o) => o.id));
  const kept = obstacles.filter((o) => !removeIds.has(o.id));
  return [...kept, ...mergedParts];
}

/** Subtract new polygon from every overlapping block obstacle. Cutter is discarded. */
export function applyPenSubtract(obstacles, cutterPoints) {
  const cutter = asPolygon(cutterPoints);
  if (!cutter) return obstacles;

  const blockObstacles = obstacles.filter((o) => o.effect === "block");
  const overlapping = blockObstacles.filter((o) => {
    const pts = pointsFromObstacle(o);
    if (!pts) return false;
    return polygonsOverlap(pts, cutterPoints);
  });

  if (!overlapping.length) return obstacles;

  const removeIds = new Set(overlapping.map((o) => o.id));
  let next = obstacles.filter((o) => !removeIds.has(o.id));

  for (const obstacle of overlapping) {
    const subject = obstacleToClippingPoly(obstacle);
    if (!subject) continue;
    try {
      const result = polygonClipping.difference(subject, cutter);
      const parts = multipolygonToObstacleParts(result, {
        effect: "block",
        source: "layer",
      });
      next = [...next, ...parts];
    } catch {
      next = [...next, obstacle];
    }
  }

  return next;
}

/** Union all block polygons that share area into combined shapes. */
export function mergeOverlappingObstacles(obstacles, { source = "layer" } = {}) {
  const blocks = obstacles.filter(
    (o) => o.type === "polygon" && o.effect !== "clear" && o.points?.length >= 3
  );
  const passthrough = obstacles.filter(
    (o) => !(o.type === "polygon" && o.effect !== "clear" && o.points?.length >= 3)
  );

  if (blocks.length <= 1) return obstacles.map((o) => ({ ...o }));

  const n = blocks.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i) {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    let cur = i;
    while (parent[cur] !== cur) {
      const next = parent[cur];
      parent[cur] = root;
      cur = next;
    }
    return root;
  }

  function unite(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }

  for (let i = 0; i < n; i += 1) {
    const ptsA = blocks[i].points;
    for (let j = i + 1; j < n; j += 1) {
      if (polygonsShouldMerge(ptsA, blocks[j].points)) unite(i, j);
    }
  }

  const groups = new Map();
  for (let i = 0; i < n; i += 1) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(blocks[i]);
  }

  const mergedBlocks = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      mergedBlocks.push({ ...group[0], source });
      continue;
    }

    let combined = obstacleToClippingPoly(group[0]);
    if (!combined) {
      mergedBlocks.push({ ...group[0], source });
      continue;
    }

    for (let k = 1; k < group.length; k += 1) {
      const other = obstacleToClippingPoly(group[k]);
      if (!other) continue;
      try {
        combined = polygonClipping.union(combined, other);
      } catch {
        /* skip invalid ring */
      }
    }

    const parts = multipolygonToObstacleParts(combined, { effect: "block", source });
    if (parts.length) mergedBlocks.push(...parts);
    else mergedBlocks.push(...group.map((o) => ({ ...o, source })));
  }

  return [...passthrough, ...mergedBlocks];
}
