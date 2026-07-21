/** Strat drawing object schema — map-% coords (−20…120). Vanilla only. */

import { STRAT_ICON_IDS } from "./icons/strat-icon-catalog.js";
import { animatedIconMotionId } from "./icons/animated-icon-ids.js";
import { resolveIconDef } from "./icons/resolve-icon.js";
import {
  HLL_OBJECT_IDS,
  resolveHllAsset,
} from "./icons/hll-object-catalog.js";
import {
  LINE_DASH_TYPES,
  endTypeFromCaps,
  normalizeLineCaps,
} from "./line-caps.js";
import { normalizeTextFields } from "./text-style.js";

export { STRAT_ICON_IDS } from "./icons/strat-icon-catalog.js";
export {
  HLL_OBJECT_IDS,
  HLL_OBJECT_OPTIONS,
  getHllObjectDef,
  getHllToolbarPreviewSrc,
  resolveHllAsset,
} from "./icons/hll-object-catalog.js";
export {
  LINE_CAP_TYPES,
  LINE_CAP_OPTIONS,
  LINE_DASH_TYPES,
  LINE_DASH_OPTIONS,
  capsFromEndType,
  endTypeFromCaps,
  normalizeLineCaps,
} from "./line-caps.js";
export {
  TEXT_FONTS,
  TEXT_SHADOW_CELLS,
  buildCanvasFont,
  isOutlineNone,
  shadowOffsetPct,
} from "./text-style.js";

export const STRAT_OBJECT_TYPES = [
  "pen",
  "line",
  "curve",
  "arrow",
  "rect",
  "ellipse",
  "text",
  "icon",
  "hll",
  "ping",
];

/** Object types that always need a continuous animation clock in CanvasRenderer. */
export const ANIMATED_OBJECT_TYPES = new Set(["ping"]);

export { ANIMATED_ICON_MOTIONS, animatedIconMotionId } from "./icons/animated-icon-ids.js";

/** Resolve motion for an icon object (toolbar iconId or StratSketch pack name). */
export function iconAnimationMotion(object) {
  if (!object || object.type !== "icon") return null;
  const meta = object.meta || {};
  const byId = animatedIconMotionId(meta.iconId);
  if (byId) return byId;
  const def = resolveIconDef(meta);
  return animatedIconMotionId(def?.name) || null;
}

export function objectNeedsAnimation(object) {
  if (!object) return false;
  if (ANIMATED_OBJECT_TYPES.has(object.type)) return true;
  return Boolean(iconAnimationMotion(object));
}

const END_TYPES = ["none", "start", "end", "both"];
const TEXT_ALIGNS = ["left", "center", "right"];
const ICON_SET = new Set(STRAT_ICON_IDS);
const HLL_SET = new Set(HLL_OBJECT_IDS);

export const STRAT_COORD_MIN = -20;
export const STRAT_COORD_MAX = 120;
export const FREEFORM_COORD_MIN = -100;
export const FREEFORM_COORD_MAX = 200;

let activeCoordMin = STRAT_COORD_MIN;
let activeCoordMax = STRAT_COORD_MAX;

export function setCoordLimits(min, max) {
  activeCoordMin = min;
  activeCoordMax = max;
}

export function resetCoordLimits() {
  activeCoordMin = STRAT_COORD_MIN;
  activeCoordMax = STRAT_COORD_MAX;
}

export function getCoordLimits() {
  return { min: activeCoordMin, max: activeCoordMax };
}

export function getCoordSpan() {
  return activeCoordMax - activeCoordMin;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizePoint(point) {
  if (!point || typeof point !== "object") return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: clamp(x, activeCoordMin, activeCoordMax),
    y: clamp(y, activeCoordMin, activeCoordMax),
  };
}

export function normalizeStyle(style = {}, type) {
  const caps = normalizeLineCaps(style);
  const normalized = {
    color: String(style.color || "#ffffff").slice(0, 32),
    size: clamp(Number(style.size) || 3, 1, 48),
    lineType: LINE_DASH_TYPES.includes(style.lineType) ? style.lineType : "solid",
    endType: END_TYPES.includes(style.endType)
      ? style.endType
      : endTypeFromCaps(caps.startCap, caps.endCap),
    startCap: caps.startCap,
    endCap: caps.endCap,
    opacity: clamp(Number.isFinite(Number(style.opacity)) ? Number(style.opacity) : 100, 0, 100),
    startSize: clamp(Number(style.startSize) || 5, 1, 24),
    endSize: clamp(Number(style.endSize) || 6, 1, 24),
    filled: Boolean(style.filled),
    fontSize: clamp(Number(style.fontSize) || 10, 6, 72),
    textAlign: TEXT_ALIGNS.includes(style.textAlign) ? style.textAlign : "center",
    ...normalizeTextFields(style),
  };

  if (type === "arrow") {
    if (normalized.endType === "none") normalized.endType = "end";
    if (normalized.endCap === "none") normalized.endCap = "arrow";
    normalized.endType = endTypeFromCaps(normalized.startCap, normalized.endCap);
  }

  // Freehand pen is stroke-only (never auto-close like a polygon).
  if (type === "pen") {
    normalized.filled = false;
  }

  return normalized;
}

function normalizeMeta(meta = {}, type) {
  const normalized = {};
  if (type === "text") {
    normalized.text = String(meta.text || "").slice(0, 200);
  }
  if (type === "icon") {
    normalized.iconId = ICON_SET.has(meta.iconId) ? meta.iconId : "check";
    normalized.iconLabel = String(meta.iconLabel || "").slice(0, 40);
    if (Number.isFinite(Number(meta.ssIconId)) && Number(meta.ssIconId) > 19) {
      normalized.ssIconId = Number(meta.ssIconId);
    }
  }
  if (type === "hll") {
    normalized.hllId = HLL_SET.has(meta.hllId) ? meta.hllId : "garrison";
    normalized.showRadius = meta.showRadius !== false;
    if (meta.placementPreview) {
      normalized.placementPreview = true;
      normalized.placeOk = meta.placeOk !== false;
    }
  }
  return normalized;
}

/** Half-extent in map-% for a newly placed / legacy 1-point icon. */
export function iconHalfExtentPct(size = 3) {
  return Math.max(0.9, (Number(size) || 3) * 0.275);
}

/** Expand a center point into a square bbox (same model as rect/ellipse). */
export function iconBoxFromCenter(center, size = 3) {
  const p = normalizePoint(center);
  if (!p) return [];
  const half = iconHalfExtentPct(size);
  return [
    normalizePoint({ x: p.x - half, y: p.y - half }),
    normalizePoint({ x: p.x + half, y: p.y + half }),
  ].filter(Boolean);
}

/** Icons use a 2-point bbox; upgrade legacy single-point icons in place. */
export function ensureIconBoxPoints(points, style = {}) {
  const list = (Array.isArray(points) ? points : []).map(normalizePoint).filter(Boolean);
  if (list.length >= 2) return list.slice(0, 2);
  if (list.length === 1) return iconBoxFromCenter(list[0], style.size);
  return list;
}

/** HLL markers use a 2-point bbox sized from the Maps Let Loose catalog. */
export function hllBoxFromCenter(center, meta = {}) {
  const p = normalizePoint(center);
  if (!p) return [];
  const asset = resolveHllAsset(meta);
  const halfW = Math.max(0.35, (asset?.sizeWPct || 2.5) / 2);
  const halfH = Math.max(0.35, (asset?.sizeHPct || asset?.sizeWPct || 2.5) / 2);
  return [
    normalizePoint({ x: p.x - halfW, y: p.y - halfH }),
    normalizePoint({ x: p.x + halfW, y: p.y + halfH }),
  ].filter(Boolean);
}

export function ensureHllBoxPoints(points, meta = {}) {
  const list = (Array.isArray(points) ? points : []).map(normalizePoint).filter(Boolean);
  if (list.length >= 2) return list.slice(0, 2);
  if (list.length === 1) return hllBoxFromCenter(list[0], meta);
  return list;
}

/** Default text box from center (map-%). */
export function textBoxFromCenter(center, style = {}) {
  const p = normalizePoint(center);
  if (!p) return [];
  const fs = Number(style.fontSize) || 10;
  const halfW = Math.max(2.5, fs * 0.55);
  const halfH = Math.max(1.2, fs * 0.22);
  return [
    normalizePoint({ x: p.x - halfW, y: p.y - halfH }),
    normalizePoint({ x: p.x + halfW, y: p.y + halfH }),
  ].filter(Boolean);
}

export function ensureTextBoxPoints(points, style = {}) {
  const list = (Array.isArray(points) ? points : []).map(normalizePoint).filter(Boolean);
  if (list.length >= 2) return list.slice(0, 2);
  if (list.length === 1) return textBoxFromCenter(list[0], style);
  return list;
}

/** Cubic Bézier [p0, cp1, cp2, p1] from chord endpoints.
 * CVs sit slightly off the chord (Plasticity-style) so handles are visible immediately.
 */
export function cubicPointsFromEndpoints(start, end) {
  const a = normalizePoint(start);
  const b = normalizePoint(end);
  if (!a || !b) return [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const offset = Math.min(3.5, Math.max(1.2, len * 0.12));
  const ox = (-dy / len) * offset;
  const oy = (dx / len) * offset;
  return [
    a,
    normalizePoint({
      x: a.x + dx / 3 + ox,
      y: a.y + dy / 3 + oy,
    }),
    normalizePoint({
      x: a.x + (2 * dx) / 3 + ox,
      y: a.y + (2 * dy) / 3 + oy,
    }),
    b,
  ].filter(Boolean);
}

export function ensureCurvePoints(points) {
  const list = (Array.isArray(points) ? points : []).map(normalizePoint).filter(Boolean);
  if (list.length >= 4) return list.slice(0, 4);
  if (list.length >= 2) return cubicPointsFromEndpoints(list[0], list[list.length - 1]);
  return list;
}

function sampleCubicPoint(p0, cp1, cp2, p1, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * cp1.x + 3 * u * tt * cp2.x + ttt * p1.x,
    y: uuu * p0.y + 3 * uu * t * cp1.y + 3 * u * tt * cp2.y + ttt * p1.y,
  };
}

export function createStratObject(type, { points = [], style = {}, meta = {} } = {}) {
  if (!STRAT_OBJECT_TYPES.includes(type)) {
    throw new Error(`Unknown object type: ${type}`);
  }

  const normalizedStyle = normalizeStyle(style, type);
  const normalizedMeta = normalizeMeta(meta, type);
  let normalizedPoints = points.map(normalizePoint).filter(Boolean);
  if (type === "icon") {
    normalizedPoints = ensureIconBoxPoints(normalizedPoints, normalizedStyle);
  } else if (type === "hll") {
    normalizedPoints = ensureHllBoxPoints(normalizedPoints, normalizedMeta);
  } else if (type === "text") {
    normalizedPoints = ensureTextBoxPoints(normalizedPoints, normalizedStyle);
  } else if (type === "curve") {
    normalizedPoints = ensureCurvePoints(normalizedPoints);
  }

  return {
    id: `obj-${crypto.randomUUID()}`,
    type,
    points: normalizedPoints,
    style: normalizedStyle,
    meta: normalizedMeta,
  };
}

export function cloneStratObject(object) {
  return structuredClone(object);
}

export function normalizeStratObject(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;

  let type = STRAT_OBJECT_TYPES.includes(raw.type) ? raw.type : null;
  const id = String(raw.id || "").trim();
  if (!type || !id) return null;

  // Legacy `arrow` tool → line with end caps (toolbar merge).
  if (type === "arrow") type = "line";

  let points = (Array.isArray(raw.points) ? raw.points : [])
    .map(normalizePoint)
    .filter(Boolean);

  const minPoints =
    type === "curve"
      ? 2
      : type === "pen"
        ? 2
        : type === "text" || type === "icon" || type === "hll" || type === "ping"
          ? 1
          : 2;
  if (points.length < minPoints) return null;

  const style = normalizeStyle(raw.style, raw.type === "arrow" ? "arrow" : type);
  const meta = normalizeMeta(raw.meta, type);
  if (type === "icon") {
    points = ensureIconBoxPoints(points, style);
  } else if (type === "hll") {
    points = ensureHllBoxPoints(points, meta);
  } else if (type === "text") {
    points = ensureTextBoxPoints(points, style);
  } else if (type === "curve") {
    points = ensureCurvePoints(points);
    if (points.length < 4) return null;
  }

  return {
    id,
    type,
    points,
    style,
    meta,
    zIndex: Number.isFinite(Number(raw.zIndex)) ? Number(raw.zIndex) : index,
  };
}

export function normalizeStratObjects(objects) {
  if (!Array.isArray(objects)) return [];
  return objects
    .map((object, index) => normalizeStratObject(object, index))
    .filter(Boolean)
    .map((object, index) => ({ ...object, zIndex: index }));
}

export function getObjectBounds(object) {
  if (!object?.points?.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of object.points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  // 2-point icons / HLL / text use the bbox itself (like rect/ellipse).
  if (
    (object.type === "icon" || object.type === "hll" || object.type === "text") &&
    object.points.length >= 2
  ) {
    return {
      x: minX,
      y: minY,
      w: Math.max(0.5, maxX - minX),
      h: Math.max(0.5, maxY - minY),
    };
  }

  const pad =
    object.type === "text" || object.type === "icon" || object.type === "hll" || object.type === "ping"
      ? Math.max(1.5, (object.style?.fontSize || 10) * 0.15)
      : Math.max(0.4, (object.style?.size || 3) * 0.2);

  return {
    x: minX - pad,
    y: minY - pad,
    w: Math.max(pad * 2, maxX - minX + pad * 2),
    h: Math.max(pad * 2, maxY - minY + pad * 2),
  };
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }

  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq;
  t = clamp(t, 0, 1);
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

export function hitTestObject(object, point, threshold = 1.2) {
  const bounds = getObjectBounds(object);
  if (!bounds || !point) return false;

  if (object.type === "pen" && object.points.length >= 2) {
    for (let index = 1; index < object.points.length; index += 1) {
      if (distanceToSegment(point, object.points[index - 1], object.points[index]) <= threshold) {
        return true;
      }
    }
    return false;
  }

  if (object.type === "curve" && object.points.length >= 4) {
    const [p0, cp1, cp2, p1] = object.points;
    let prev = sampleCubicPoint(p0, cp1, cp2, p1, 0);
    for (let i = 1; i <= 16; i += 1) {
      const next = sampleCubicPoint(p0, cp1, cp2, p1, i / 16);
      if (distanceToSegment(point, prev, next) <= threshold) return true;
      prev = next;
    }
    return false;
  }

  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.w &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.h
  );
}

export function settingsToObjectStyle(settings) {
  const caps = normalizeLineCaps({
    startCap: settings.startCap,
    endCap: settings.endCap,
    endType: settings.endType,
  });
  return {
    color: settings.color,
    size: settings.size,
    lineType: settings.lineType,
    endType: endTypeFromCaps(caps.startCap, caps.endCap),
    startCap: caps.startCap,
    endCap: caps.endCap,
    opacity: settings.opacity,
    startSize: settings.startSize,
    endSize: settings.endSize,
    filled: settings.filled,
    fontSize: settings.fontSize,
    textStyle: settings.textStyle,
    textAlign: settings.textAlign,
    fontFamily: settings.fontFamily,
    bold: settings.bold,
    italic: settings.italic,
    underline: settings.underline,
    textVAlign: settings.textVAlign,
    outlineColor: settings.outlineColor,
    outlineWidth: settings.outlineWidth,
    shadow: settings.shadow,
    padding: settings.padding,
    rotation: settings.rotation,
  };
}
