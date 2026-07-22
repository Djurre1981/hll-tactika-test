import { clampPct } from "../constants.js";
import { distMapPct } from "../path/coords.js";

export const PEN_CLOSE_THRESHOLD = 1.4;
export const PEN_VERTEX_THRESHOLD = 1.4;
export const PEN_SEGMENT_THRESHOLD = 1.15;

const BOX_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export function clampPoint(p) {
  return { x: clampPct(p.x), y: clampPct(p.y) };
}

export function bboxFromPoints(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    x1: Math.min(...xs),
    y1: Math.min(...ys),
    x2: Math.max(...xs),
    y2: Math.max(...ys),
  };
}

export function pointsFromBox(box) {
  return [
    clampPoint({ x: box.x1, y: box.y1 }),
    clampPoint({ x: box.x2, y: box.y2 }),
  ];
}

function handlePosition(box, id) {
  const cx = (box.x1 + box.x2) / 2;
  const cy = (box.y1 + box.y2) / 2;
  return {
    nw: { x: box.x1, y: box.y1 },
    n: { x: cx, y: box.y1 },
    ne: { x: box.x2, y: box.y1 },
    e: { x: box.x2, y: cy },
    se: { x: box.x2, y: box.y2 },
    s: { x: cx, y: box.y2 },
    sw: { x: box.x1, y: box.y2 },
    w: { x: box.x1, y: cy },
  }[id];
}

export function pointInPolygon(point, polygon) {
  if (!polygon?.length) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 0) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Resize handles for rect/ellipse, vertex anchors for polygons. */
export function getObstacleAnchors(obstacle) {
  if (!obstacle?.points?.length) return [];

  if (obstacle.type === "polygon") {
    return obstacle.points.map((point, index) => ({
      id: `v${index}`,
      index,
      x: point.x,
      y: point.y,
      kind: "vertex",
    }));
  }

  const box = bboxFromPoints(obstacle.points);
  return BOX_HANDLES.map((id) => ({
    id,
    x: handlePosition(box, id).x,
    y: handlePosition(box, id).y,
    kind: "handle",
  }));
}

export function getObstacleHandles(obstacle) {
  return getObstacleAnchors(obstacle).filter((anchor) => anchor.kind === "handle");
}

export function hitTestHandle(handles, point, threshold = 1.4) {
  for (const handle of handles) {
    if (Math.hypot(point.x - handle.x, point.y - handle.y) <= threshold) {
      return handle;
    }
  }
  return null;
}

export function hitTestObstacle(obstacle, point) {
  if (!obstacle?.points?.length) return false;

  if (obstacle.type === "polygon") {
    return pointInPolygon(point, obstacle.points);
  }

  const box = bboxFromPoints(obstacle.points);
  if (obstacle.type === "ellipse") {
    const cx = (box.x1 + box.x2) / 2;
    const cy = (box.y1 + box.y2) / 2;
    const rx = Math.abs(box.x2 - box.x1) / 2 || 0.001;
    const ry = Math.abs(box.y2 - box.y1) / 2 || 0.001;
    const nx = (point.x - cx) / rx;
    const ny = (point.y - cy) / ry;
    return nx * nx + ny * ny <= 1;
  }

  return point.x >= box.x1 && point.x <= box.x2 && point.y >= box.y1 && point.y <= box.y2;
}

function isCornerHandle(handleId) {
  return handleId === "nw" || handleId === "ne" || handleId === "se" || handleId === "sw";
}

function constrainCornerBox(origBox, handleId, cursor, ratio = 1) {
  const anchor = {
    nw: { x: origBox.x2, y: origBox.y2 },
    ne: { x: origBox.x1, y: origBox.y2 },
    se: { x: origBox.x1, y: origBox.y1 },
    sw: { x: origBox.x2, y: origBox.y1 },
  }[handleId];
  if (!anchor || !cursor) return null;

  let dx = cursor.x - anchor.x;
  let dy = cursor.y - anchor.y;
  if (dx === 0 && dy === 0) {
    dx = Math.sign(origBox.x2 - origBox.x1) || 1;
    dy = Math.sign(origBox.y2 - origBox.y1) || 1;
  }

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  let w;
  let h;
  if (absDx >= absDy * ratio) {
    w = absDx;
    h = w / ratio;
  } else {
    h = absDy;
    w = h * ratio;
  }

  const x2 = anchor.x + Math.sign(dx || 1) * w;
  const y2 = anchor.y + Math.sign(dy || 1) * h;
  return {
    x1: Math.min(anchor.x, x2),
    y1: Math.min(anchor.y, y2),
    x2: Math.max(anchor.x, x2),
    y2: Math.max(anchor.y, y2),
  };
}

/** Move a single polygon vertex (anchor point). */
export function applyObstacleAnchorDrag(originalPoints, anchorIndex, cursor) {
  if (!originalPoints?.length || anchorIndex == null) return originalPoints;
  return originalPoints.map((point, index) =>
    index === anchorIndex ? clampPoint(cursor) : point
  );
}

/** Resize rect/ellipse bbox via strat-style handle drag. */
export function applyObstacleHandleDrag(obstacle, handleId, cursor, originalPoints, options = {}) {
  if (!originalPoints?.length || originalPoints.length < 2) return originalPoints;
  if (obstacle.type === "polygon") return originalPoints;

  const origBox = bboxFromPoints(originalPoints);
  let box = { ...origBox };
  const shift = Boolean(options.shift);
  const ratio =
    obstacle.type === "ellipse" && shift
      ? Math.abs(origBox.x2 - origBox.x1) / Math.max(Math.abs(origBox.y2 - origBox.y1), 0.001)
      : Math.abs(origBox.x2 - origBox.x1) / Math.max(Math.abs(origBox.y2 - origBox.y1), 0.001);

  if (shift && isCornerHandle(handleId)) {
    const locked = constrainCornerBox(origBox, handleId, cursor, ratio || 1);
    if (locked) box = locked;
  } else {
    if (handleId.includes("n")) box.y1 = cursor.y;
    if (handleId.includes("s")) box.y2 = cursor.y;
    if (handleId.includes("w")) box.x1 = cursor.x;
    if (handleId.includes("e")) box.x2 = cursor.x;
    if (handleId === "n" || handleId === "s") {
      box.x1 = origBox.x1;
      box.x2 = origBox.x2;
    }
    if (handleId === "e" || handleId === "w") {
      box.y1 = origBox.y1;
      box.y2 = origBox.y2;
    }
    if (box.x2 < box.x1) [box.x1, box.x2] = [box.x2, box.x1];
    if (box.y2 < box.y1) [box.y1, box.y2] = [box.y2, box.y1];
  }

  return pointsFromBox(box);
}

export function nudgeObstaclePoints(points, dx, dy) {
  return points.map((p) => clampPoint({ x: p.x + dx, y: p.y + dy }));
}

export function createPolygonObstacle(effect, points) {
  const cleaned = points.map(clampPoint).filter(Boolean);
  if (cleaned.length < 3) return null;
  return {
    id: `obs-${crypto.randomUUID()}`,
    type: "polygon",
    effect,
    source: "user",
    points: cleaned,
  };
}

export function createObstacle(type, effect, p0, p1) {
  return {
    id: `obs-${crypto.randomUUID()}`,
    type,
    effect,
    source: "user",
    points: pointsFromBox(bboxFromPoints([p0, p1])),
  };
}

export function isNearPoint(a, b, threshold = PEN_CLOSE_THRESHOLD) {
  return distMapPct(a, b) <= threshold;
}

function distToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    const dist = Math.hypot(point.x - a.x, point.y - a.y);
    return { dist, point: { ...a } };
  }
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return { dist: Math.hypot(point.x - proj.x, point.y - proj.y), point: proj };
}

/** Closest edge on a closed polygon (map pct space). */
export function hitTestPolygonSegment(points, point, threshold = PEN_SEGMENT_THRESHOLD) {
  if (!points?.length || points.length < 2) return null;

  let best = null;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const { dist, point: proj } = distToSegment(point, a, b);
    if (dist > threshold) continue;
    if (!best || dist < best.dist) {
      best = { segmentIndex: i, point: clampPoint(proj), dist };
    }
  }
  return best;
}

export function hitTestPolygonVertex(points, point, threshold = PEN_VERTEX_THRESHOLD) {
  if (!points?.length) return -1;
  let bestIndex = -1;
  let bestDist = threshold;
  for (let i = 0; i < points.length; i++) {
    const dist = distMapPct(point, points[i]);
    if (dist <= bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * Illustrator-style contextual pen target on a selected path.
 * Shift disables auto add/delete so a new path can start on the selection.
 */
export function resolvePenTarget(obstacle, point, { shift = false } = {}) {
  if (shift || !obstacle?.points?.length) return { mode: "draw" };

  if (obstacle.type === "polygon" && obstacle.points.length >= 3) {
    const vertexIndex = hitTestPolygonVertex(obstacle.points, point);
    if (vertexIndex >= 0) {
      return {
        mode: "delete",
        vertexIndex,
        point: obstacle.points[vertexIndex],
      };
    }
    const segment = hitTestPolygonSegment(obstacle.points, point);
    if (segment) {
      return {
        mode: "add",
        segmentIndex: segment.segmentIndex,
        point: segment.point,
      };
    }
    return { mode: "draw" };
  }

  if (obstacle.type === "rect" || obstacle.type === "ellipse") {
    const box = bboxFromPoints(obstacle.points);
    const ring = [
      { x: box.x1, y: box.y1 },
      { x: box.x2, y: box.y1 },
      { x: box.x2, y: box.y2 },
      { x: box.x1, y: box.y2 },
    ];
    const vertexIndex = hitTestPolygonVertex(ring, point);
    if (vertexIndex >= 0) {
      return { mode: "delete", vertexIndex, point: ring[vertexIndex] };
    }
    const segment = hitTestPolygonSegment(ring, point);
    if (segment) {
      return {
        mode: "add",
        segmentIndex: segment.segmentIndex,
        point: segment.point,
      };
    }
  }

  return { mode: "draw" };
}

export function insertPolygonVertex(points, segmentIndex, point) {
  const next = points.map(clampPoint);
  next.splice(segmentIndex + 1, 0, clampPoint(point));
  return next;
}

export function removePolygonVertex(points, vertexIndex) {
  if (!points?.length || points.length <= 3 || vertexIndex < 0) return null;
  return points.filter((_, index) => index !== vertexIndex).map(clampPoint);
}

/** Convert rect/ellipse bbox handles to an editable polygon ring. */
export function obstacleToPolygonPoints(obstacle) {
  if (obstacle.type === "polygon") return obstacle.points.map(clampPoint);
  const box = bboxFromPoints(obstacle.points);
  return [
    clampPoint({ x: box.x1, y: box.y1 }),
    clampPoint({ x: box.x2, y: box.y1 }),
    clampPoint({ x: box.x2, y: box.y2 }),
    clampPoint({ x: box.x1, y: box.y2 }),
  ];
}

export function polygonPointsAttr(points, imgW, imgH) {
  return points
    .map((point) => `${(point.x / 100) * imgW},${(point.y / 100) * imgH}`)
    .join(" ");
}
