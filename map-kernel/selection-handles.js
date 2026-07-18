import { clamp, getObjectBounds, STRAT_COORD_MAX, STRAT_COORD_MIN } from "./object-schema.js";

const HANDLE_HIT = 0.95;
const BOX_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CURVE_HANDLE_IDS = ["p0", "cp1", "cp2", "p1"];
/** Target on-screen radius (px) for curve handle hit / draw at any zoom. */
const CURVE_HANDLE_SCREEN_PX = 14;

export function getBoxFromObjectPoints(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    x1: Math.min(...xs),
    y1: Math.min(...ys),
    x2: Math.max(...xs),
    y2: Math.max(...ys),
  };
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

export function getSelectionHandles(object) {
  if (object?.type === "curve" && object.points?.length >= 4) {
    return CURVE_HANDLE_IDS.map((id, index) => ({
      id,
      x: object.points[index].x,
      y: object.points[index].y,
    }));
  }

  const bounds = getObjectBounds(object);
  if (!bounds) return [];
  const box = {
    x1: bounds.x,
    y1: bounds.y,
    x2: bounds.x + bounds.w,
    y2: bounds.y + bounds.h,
  };
  return BOX_HANDLES.map((id) => ({ id, ...handlePosition(box, id) }));
}

export function hitTestSelectionHandle(handles, point, threshold = HANDLE_HIT) {
  for (const handle of handles) {
    if (Math.hypot(point.x - handle.x, point.y - handle.y) <= threshold) {
      return handle;
    }
  }
  return null;
}

/** Map-% hit radius so curve handles stay ~CURVE_HANDLE_SCREEN_PX on screen. */
export function curveHandleHitPct(viewScale, mapSize = 1920) {
  const scale = Math.max(0.08, Number(viewScale) || 1);
  const size = Math.max(256, Number(mapSize) || 1920);
  return ((CURVE_HANDLE_SCREEN_PX * 1.15) / scale / size) * 100;
}

/** Canvas-pixel sizes for curve edit chrome (screen-constant across zoom). */
export function curveHandleDrawSizes(viewScale) {
  const scale = Math.max(0.08, Number(viewScale) || 1);
  const endpoint = Math.min(28, Math.max(7, CURVE_HANDLE_SCREEN_PX / scale));
  const control = endpoint * 0.78;
  const armWidth = Math.min(3.5, Math.max(1.1, 1.6 / scale));
  const stroke = Math.min(2.8, Math.max(1.2, 1.5 / scale));
  return { endpoint, control, armWidth, stroke };
}

function clampPoint(point) {
  return {
    x: clamp(point.x, STRAT_COORD_MIN, STRAT_COORD_MAX),
    y: clamp(point.y, STRAT_COORD_MIN, STRAT_COORD_MAX),
  };
}

function scalePenPoints(points, fromBox, toBox) {
  const fromW = fromBox.x2 - fromBox.x1 || 1;
  const fromH = fromBox.y2 - fromBox.y1 || 1;
  return points.map((p) =>
    clampPoint({
      x: toBox.x1 + ((p.x - fromBox.x1) / fromW) * (toBox.x2 - toBox.x1),
      y: toBox.y1 + ((p.y - fromBox.y1) / fromH) * (toBox.y2 - toBox.y1),
    })
  );
}

export function applyHandleDrag(object, handleId, cursor, originalPoints, penOriginalBox) {
  if (object.type === "curve" && originalPoints.length >= 4) {
    const index = CURVE_HANDLE_IDS.indexOf(handleId);
    if (index < 0) return originalPoints;
    return originalPoints.map((p, i) => (i === index ? clampPoint(cursor) : p));
  }

  if (object.type === "pen" && penOriginalBox) {
    const box = { ...penOriginalBox };
    const cx = (box.x1 + box.x2) / 2;
    const cy = (box.y1 + box.y2) / 2;
    if (handleId.includes("n")) box.y1 = cursor.y;
    if (handleId.includes("s")) box.y2 = cursor.y;
    if (handleId.includes("w")) box.x1 = cursor.x;
    if (handleId.includes("e")) box.x2 = cursor.x;
    if (handleId === "n" || handleId === "s") {
      box.x1 = penOriginalBox.x1;
      box.x2 = penOriginalBox.x2;
    }
    if (handleId === "e" || handleId === "w") {
      box.y1 = penOriginalBox.y1;
      box.y2 = penOriginalBox.y2;
    }
    if (box.x2 < box.x1) [box.x1, box.x2] = [box.x2, box.x1];
    if (box.y2 < box.y1) [box.y1, box.y2] = [box.y2, box.y1];
    return scalePenPoints(originalPoints, penOriginalBox, box);
  }

  if (object.type === "text" || object.type === "ping") {
    return [clampPoint(cursor)];
  }

  if (originalPoints.length < 2) return originalPoints;

  const box = getBoxFromObjectPoints(originalPoints);
  if (handleId.includes("n")) box.y1 = cursor.y;
  if (handleId.includes("s")) box.y2 = cursor.y;
  if (handleId.includes("w")) box.x1 = cursor.x;
  if (handleId.includes("e")) box.x2 = cursor.x;
  if (handleId === "n" || handleId === "s") {
    /* keep x */
  }
  if (handleId === "e" || handleId === "w") {
    /* keep y */
  }
  if (box.x2 < box.x1) [box.x1, box.x2] = [box.x2, box.x1];
  if (box.y2 < box.y1) [box.y1, box.y2] = [box.y2, box.y1];

  return [
    clampPoint({ x: box.x1, y: box.y1 }),
    clampPoint({ x: box.x2, y: box.y2 }),
  ];
}

export function nudgePoints(points, dx, dy) {
  return points.map((p) => clampPoint({ x: p.x + dx, y: p.y + dy }));
}
