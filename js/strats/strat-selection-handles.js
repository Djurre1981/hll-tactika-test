import { clampMapPoint } from "./strat-draw-modifiers.js";
import { getObjectBounds } from "./strat-object-schema.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const HANDLE_RADIUS = 0.38;
const HANDLE_HIT = 0.95;

const BOX_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function getBoxFromPoints(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x1: Math.min(...xs),
    y1: Math.min(...ys),
    x2: Math.max(...xs),
    y2: Math.max(...ys),
  };
}

function boxToPoints(box) {
  return [
    { x: box.x1, y: box.y1 },
    { x: box.x2, y: box.y2 },
  ];
}

function handlePosition(box, id) {
  const cx = (box.x1 + box.x2) / 2;
  const cy = (box.y1 + box.y2) / 2;
  const map = {
    nw: { x: box.x1, y: box.y1 },
    n: { x: cx, y: box.y1 },
    ne: { x: box.x2, y: box.y1 },
    e: { x: box.x2, y: cy },
    se: { x: box.x2, y: box.y2 },
    s: { x: cx, y: box.y2 },
    sw: { x: box.x1, y: box.y2 },
    w: { x: box.x1, y: cy },
  };
  return map[id];
}

function oppositeHandle(id) {
  const pairs = {
    nw: "se", n: "s", ne: "sw", e: "w", se: "nw", s: "n", sw: "ne", w: "e",
  };
  return pairs[id];
}

function constrainProportionalDelta(dx, dy, aspect) {
  const visualW = Math.abs(dx) * aspect;
  const visualH = Math.abs(dy);
  const visualSize = Math.max(visualW, visualH);
  return {
    dx: (visualSize * Math.sign(dx || 1)) / aspect,
    dy: visualSize * Math.sign(dy || 1),
  };
}

function enforceMinBox(box, aspect, minVisual = 0.35) {
  const w = (box.x2 - box.x1) * aspect;
  const h = box.y2 - box.y1;
  if (w >= minVisual && h >= minVisual) return box;
  const cx = (box.x1 + box.x2) / 2;
  const cy = (box.y1 + box.y2) / 2;
  const halfW = Math.max(minVisual / aspect / 2, Math.abs(box.x2 - box.x1) / 2);
  const halfH = Math.max(minVisual / 2, Math.abs(box.y2 - box.y1) / 2);
  return {
    x1: cx - halfW,
    y1: cy - halfH,
    x2: cx + halfW,
    y2: cy + halfH,
  };
}

function scalePenPoints(points, fromBox, toBox) {
  const fromW = fromBox.x2 - fromBox.x1 || 1;
  const fromH = fromBox.y2 - fromBox.y1 || 1;
  const toW = toBox.x2 - toBox.x1;
  const toH = toBox.y2 - toBox.y1;
  return points.map((point) => ({
    x: toBox.x1 + ((point.x - fromBox.x1) / fromW) * toW,
    y: toBox.y1 + ((point.y - fromBox.y1) / fromH) * toH,
  })).map(clampMapPoint);
}

function applyBoxHandleDrag(currentBox, handleId, cursor, aspect, modifiers) {
  const box = { ...currentBox };
  const point = clampMapPoint(cursor);

  if (handleId === "n") {
    box.y1 = point.y;
  } else if (handleId === "s") {
    box.y2 = point.y;
  } else if (handleId === "w") {
    box.x1 = point.x;
  } else if (handleId === "e") {
    box.x2 = point.x;
  } else {
    const fixed = handlePosition(currentBox, oppositeHandle(handleId));
    let moving = point;
    if (modifiers.shift) {
      const dx = moving.x - fixed.x;
      const dy = moving.y - fixed.y;
      const constrained = constrainProportionalDelta(dx, dy, aspect);
      moving = clampMapPoint({
        x: fixed.x + constrained.dx,
        y: fixed.y + constrained.dy,
      });
    }
    box.x1 = Math.min(fixed.x, moving.x);
    box.y1 = Math.min(fixed.y, moving.y);
    box.x2 = Math.max(fixed.x, moving.x);
    box.y2 = Math.max(fixed.y, moving.y);
  }

  if (box.x1 > box.x2) {
    [box.x1, box.x2] = [box.x2, box.x1];
  }
  if (box.y1 > box.y2) {
    [box.y1, box.y2] = [box.y2, box.y1];
  }

  return enforceMinBox(box, aspect);
}

export function getSelectionHandles(object) {
  if (!object) return [];

  if (object.type === "line" || object.type === "arrow") {
    return object.points.slice(0, 2).map((point, index) => ({
      id: `p${index}`,
      x: point.x,
      y: point.y,
      kind: "point",
    }));
  }

  const bounds = getObjectBounds(object);
  if (!bounds) return [];

  const box = { x1: bounds.x, y1: bounds.y, x2: bounds.x + bounds.w, y2: bounds.y + bounds.h };
  return BOX_HANDLES.map((id) => ({
    id,
    x: handlePosition(box, id).x,
    y: handlePosition(box, id).y,
    kind: "box",
  }));
}

export function hitTestSelectionHandle(handles, point) {
  if (!point || !handles.length) return null;
  let best = null;
  let bestDist = HANDLE_HIT;
  for (const handle of handles) {
    const dist = Math.hypot(point.x - handle.x, point.y - handle.y);
    if (dist <= bestDist) {
      best = handle;
      bestDist = dist;
    }
  }
  return best;
}

export function applyHandleDrag(object, handleId, cursor, aspect, modifiers, { penOriginalBox = null } = {}) {
  if (!object) return null;

  if (object.type === "line" || object.type === "arrow") {
    const index = Number(handleId.replace("p", ""));
    if (!Number.isFinite(index)) return null;
    const next = object.points.map((point, i) => (i === index ? clampMapPoint(cursor) : { ...point }));
    return { points: next };
  }

  if (!BOX_HANDLES.includes(handleId)) return null;

  const currentBox = getBoxFromPoints(object.points);
  const nextBox = applyBoxHandleDrag(currentBox, handleId, cursor, aspect, modifiers);

  if (object.type === "pen" && penOriginalBox) {
    return { points: scalePenPoints(object.points, penOriginalBox, nextBox) };
  }

  return { points: boxToPoints(nextBox).map(clampMapPoint) };
}

export function renderSelectionOverlay(object) {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", "strat-selection");
  group.dataset.stratSelection = "true";

  const bounds = getObjectBounds(object);
  if (!bounds) return group;

  const outline = document.createElementNS(SVG_NS, "rect");
  outline.setAttribute("class", "strat-selection__outline");
  outline.setAttribute("x", String(bounds.x));
  outline.setAttribute("y", String(bounds.y));
  outline.setAttribute("width", String(bounds.w));
  outline.setAttribute("height", String(bounds.h));
  outline.setAttribute("fill", "none");
  outline.setAttribute("stroke", "rgba(255,255,255,0.85)");
  outline.setAttribute("stroke-width", "0.1");
  outline.setAttribute("stroke-dasharray", "0.35 0.25");
  group.appendChild(outline);

  for (const handle of getSelectionHandles(object)) {
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("class", "strat-selection__handle");
    circle.setAttribute("data-handle-id", handle.id);
    circle.setAttribute("cx", String(handle.x));
    circle.setAttribute("cy", String(handle.y));
    circle.setAttribute("r", String(HANDLE_RADIUS));
    group.appendChild(circle);
  }

  return group;
}

export function getObjectTypeLabel(type) {
  const labels = {
    pen: "Freehand",
    line: "Line",
    arrow: "Arrow",
    rect: "Rectangle",
    ellipse: "Circle",
    text: "Text",
    icon: "Icon",
    ping: "Ping",
  };
  return labels[type] || type;
}

export function getBoxFromObjectPoints(points) {
  return getBoxFromPoints(points);
}
