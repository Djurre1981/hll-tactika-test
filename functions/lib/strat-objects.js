const STRAT_OBJECT_TYPES = [
  "pen",
  "line",
  "arrow",
  "rect",
  "ellipse",
  "text",
  "icon",
  "ping",
];

const LINE_TYPES = ["solid", "dashed", "dotted"];
const END_TYPES = ["none", "start", "end"];
const TEXT_ALIGNS = ["left", "center", "right"];
const ICON_IDS = new Set([
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
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizePoint(point) {
  if (!point || typeof point !== "object") return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
  };
}

function normalizeStyle(style = {}, type) {
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
    normalized.iconId = ICON_IDS.has(meta.iconId) ? meta.iconId : "check";
    normalized.iconLabel = String(meta.iconLabel || "").slice(0, 40);
  }
  return normalized;
}

export function normalizeStratObject(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;

  const type = STRAT_OBJECT_TYPES.includes(raw.type) ? raw.type : null;
  const id = String(raw.id || "").trim();
  if (!type || !id) return null;

  const points = (Array.isArray(raw.points) ? raw.points : [])
    .map(normalizePoint)
    .filter(Boolean);

  const minPoints = type === "pen" ? 2 : type === "text" || type === "icon" || type === "ping" ? 1 : 2;
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

export function sanitizeStratObjects(objects) {
  if (!Array.isArray(objects)) return [];
  return objects
    .map((object, index) => normalizeStratObject(object, index))
    .filter(Boolean)
    .slice(0, 500)
    .map((object, index) => ({ ...object, zIndex: index }));
}
