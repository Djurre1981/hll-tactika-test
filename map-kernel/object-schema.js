/** Strat drawing object schema — map-% coords (−20…120). Vanilla only. */

export const STRAT_OBJECT_TYPES = [
  "pen",
  "line",
  "arrow",
  "rect",
  "ellipse",
  "text",
  "icon",
  "ping",
];

export const STRAT_ICON_IDS = [
  "check",
  "xmark",
  "circle-question",
  "circle-info",
  "triangle-exclamation",
  "house",
  "ban",
  "binoculars",
  "bomb",
  "car-side",
  "truck-pickup",
  "jet-fighter",
  "crosshairs",
  "flag",
  "gun",
  "shield",
  "skull-crossbones",
  "person-rifle",
  "map-pin",
  "location-dot",
];

export const ICON_GLYPHS = {
  check: "✓",
  xmark: "✕",
  "circle-question": "?",
  "circle-info": "i",
  "triangle-exclamation": "!",
  house: "⌂",
  ban: "⊘",
  binoculars: "◎",
  bomb: "✹",
  "car-side": "▣",
  "truck-pickup": "▣",
  "jet-fighter": "▲",
  crosshairs: "+",
  flag: "⚑",
  gun: "╋",
  shield: "⛨",
  "skull-crossbones": "☠",
  "person-rifle": "⚔",
  "map-pin": "📍",
  "location-dot": "•",
};

const LINE_TYPES = ["solid", "dashed", "dotted"];
const END_TYPES = ["none", "start", "end"];
const TEXT_ALIGNS = ["left", "center", "right"];
const ICON_SET = new Set(STRAT_ICON_IDS);

export const STRAT_COORD_MIN = -20;
export const STRAT_COORD_MAX = 120;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizePoint(point) {
  if (!point || typeof point !== "object") return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: clamp(x, STRAT_COORD_MIN, STRAT_COORD_MAX),
    y: clamp(y, STRAT_COORD_MIN, STRAT_COORD_MAX),
  };
}

export function normalizeStyle(style = {}, type) {
  const normalized = {
    color: String(style.color || "#ffffff").slice(0, 32),
    size: clamp(Number(style.size) || 3, 1, 48),
    lineType: LINE_TYPES.includes(style.lineType) ? style.lineType : "solid",
    endType: END_TYPES.includes(style.endType) ? style.endType : "none",
    filled: Boolean(style.filled),
    fontSize: clamp(Number(style.fontSize) || 10, 6, 48),
    textStyle: clamp(Number(style.textStyle) || 0, 0, 2),
    textAlign: TEXT_ALIGNS.includes(style.textAlign) ? style.textAlign : "center",
  };

  if (type === "arrow" && normalized.endType === "none") {
    normalized.endType = "end";
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
  return normalized;
}

export function createStratObject(type, { points = [], style = {}, meta = {} } = {}) {
  if (!STRAT_OBJECT_TYPES.includes(type)) {
    throw new Error(`Unknown object type: ${type}`);
  }

  return {
    id: `obj-${crypto.randomUUID()}`,
    type,
    points: points.map(normalizePoint).filter(Boolean),
    style: normalizeStyle(style, type),
    meta: normalizeMeta(meta, type),
  };
}

export function cloneStratObject(object) {
  return structuredClone(object);
}

export function normalizeStratObject(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;

  const type = STRAT_OBJECT_TYPES.includes(raw.type) ? raw.type : null;
  const id = String(raw.id || "").trim();
  if (!type || !id) return null;

  const points = (Array.isArray(raw.points) ? raw.points : [])
    .map(normalizePoint)
    .filter(Boolean);

  const minPoints =
    type === "pen" ? 2 : type === "text" || type === "icon" || type === "ping" ? 1 : 2;
  if (points.length < minPoints) return null;

  return {
    id,
    type,
    points,
    style: normalizeStyle(raw.style, type),
    meta: normalizeMeta(raw.meta, type),
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

  const pad =
    object.type === "text" || object.type === "icon" || object.type === "ping"
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

  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.w &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.h
  );
}

export function settingsToObjectStyle(settings) {
  return {
    color: settings.color,
    size: settings.size,
    lineType: settings.lineType,
    endType: settings.endType,
    filled: settings.filled,
    fontSize: settings.fontSize,
    textStyle: settings.textStyle,
    textAlign: settings.textAlign,
  };
}
