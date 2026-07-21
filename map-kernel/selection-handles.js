import { clamp, getCoordLimits, getObjectBounds } from "./object-schema.js";

const HANDLE_HIT = 0.95;
const BOX_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CURVE_HANDLE_IDS = ["p0", "cp1", "cp2", "p1"];
const LINE_HANDLE_IDS = ["p0", "p1"];
/** Target on-screen radius (px) for curve/line handle hit / draw at any zoom. */
const CURVE_HANDLE_SCREEN_PX = 14;

function isLineStrokeType(type) {
  return type === "line" || type === "arrow";
}

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

/** Green rotation handle above the box (map-%). */
export function getRotationHandle(object) {
  if (object?.type !== "text") return null;
  const bounds = getObjectBounds(object);
  if (!bounds) return null;
  const lift = Math.max(1.8, bounds.h * 0.2 + 1.4);
  return {
    id: "rotate",
    x: bounds.x + bounds.w / 2,
    y: bounds.y - lift,
  };
}

export function getSelectionHandles(object) {
  if (object?.type === "curve" && object.points?.length >= 4) {
    return CURVE_HANDLE_IDS.map((id, index) => ({
      id,
      x: object.points[index].x,
      y: object.points[index].y,
    }));
  }

  if (isLineStrokeType(object?.type) && object.points?.length >= 2) {
    return LINE_HANDLE_IDS.map((id, index) => ({
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
  const handles = BOX_HANDLES.map((id) => ({ id, ...handlePosition(box, id) }));
  const rot = getRotationHandle(object);
  if (rot) handles.push(rot);
  return handles;
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
  const { min, max } = getCoordLimits();
  return {
    x: clamp(point.x, min, max),
    y: clamp(point.y, min, max),
  };
}

function isCornerHandle(handleId) {
  return handleId === "nw" || handleId === "ne" || handleId === "se" || handleId === "sw";
}

/**
 * Lock resize to a width/height ratio (map-%), anchored on the opposite corner.
 * @param {number} ratio map-% width / height (for visual 1:1 use 1/mapAspect)
 */
function constrainCornerBox(origBox, handleId, cursor, ratio) {
  const anchor = {
    nw: { x: origBox.x2, y: origBox.y2 },
    ne: { x: origBox.x1, y: origBox.y2 },
    se: { x: origBox.x1, y: origBox.y1 },
    sw: { x: origBox.x2, y: origBox.y1 },
  }[handleId];
  if (!anchor || !cursor) return null;

  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
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
  if (absDx >= absDy * safeRatio) {
    w = absDx;
    h = w / safeRatio;
  } else {
    h = absDy;
    w = h * safeRatio;
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

/** Map-% width/height target while Shift-resizing a corner. */
function shiftResizeRatio(object, origBox, mapAspect) {
  const aspect = Number.isFinite(mapAspect) && mapAspect > 0 ? mapAspect : 1;
  // Icons / HLL markers are meant to stay visually square (1:1 on the tacmap).
  if (object?.type === "icon" || object?.type === "hll") {
    return 1 / aspect;
  }
  const w = Math.abs(origBox.x2 - origBox.x1) || 1;
  const h = Math.abs(origBox.y2 - origBox.y1) || 1;
  return w / h;
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

export function applyHandleDrag(
  object,
  handleId,
  cursor,
  originalPoints,
  penOriginalBox,
  options = {}
) {
  if (handleId === "rotate") return originalPoints;

  const shift = Boolean(options.shift);
  const mapAspect = options.aspect ?? 1;

  if (object.type === "curve" && originalPoints.length >= 4) {
    const index = CURVE_HANDLE_IDS.indexOf(handleId);
    if (index < 0) return originalPoints;
    return originalPoints.map((p, i) => (i === index ? clampPoint(cursor) : p));
  }

  if (isLineStrokeType(object.type) && originalPoints.length >= 2) {
    const index = LINE_HANDLE_IDS.indexOf(handleId);
    if (index < 0) return originalPoints;
    return originalPoints.map((p, i) => (i === index ? clampPoint(cursor) : p));
  }

  if (object.type === "pen" && penOriginalBox) {
    let box = { ...penOriginalBox };
    if (shift && isCornerHandle(handleId)) {
      const locked = constrainCornerBox(
        penOriginalBox,
        handleId,
        cursor,
        shiftResizeRatio(object, penOriginalBox, mapAspect)
      );
      if (locked) box = locked;
    } else {
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
    }
    return scalePenPoints(originalPoints, penOriginalBox, box);
  }

  if (object.type === "ping") {
    return [clampPoint(cursor)];
  }

  if (originalPoints.length < 2) return originalPoints;

  const origBox = getBoxFromObjectPoints(originalPoints);
  let box = { ...origBox };

  if (shift && isCornerHandle(handleId)) {
    const locked = constrainCornerBox(
      origBox,
      handleId,
      cursor,
      shiftResizeRatio(object, origBox, mapAspect)
    );
    if (locked) box = locked;
  } else {
    if (handleId.includes("n")) box.y1 = cursor.y;
    if (handleId.includes("s")) box.y2 = cursor.y;
    if (handleId.includes("w")) box.x1 = cursor.x;
    if (handleId.includes("e")) box.x2 = cursor.x;
    if (box.x2 < box.x1) [box.x1, box.x2] = [box.x2, box.x1];
    if (box.y2 < box.y1) [box.y1, box.y2] = [box.y2, box.y1];
  }

  return [
    clampPoint({ x: box.x1, y: box.y1 }),
    clampPoint({ x: box.x2, y: box.y2 }),
  ];
}

/** Angle in degrees from box center to cursor (0 = up, clockwise). */
export function rotationDegreesFromCursor(object, cursor) {
  const bounds = getObjectBounds(object);
  if (!bounds || !cursor) return 0;
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const rad = Math.atan2(cursor.x - cx, cy - cursor.y);
  return (rad * 180) / Math.PI;
}

export function nudgePoints(points, dx, dy) {
  return points.map((p) => clampPoint({ x: p.x + dx, y: p.y + dy }));
}
