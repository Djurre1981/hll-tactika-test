const STRAT_OBJECT_TYPES = [
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

const LINE_TYPES = ["solid", "dashed", "dotted"];
const END_TYPES = ["none", "start", "end", "both"];
const TEXT_ALIGNS = ["left", "center", "right"];
const ICON_IDS = new Set([
  "check",
  "xmark",
  "circle-question",
  "circle-info",
  "triangle-exclamation",
  "message-exclamation",
  "message-dots",
  "house",
  "ban",
  "binoculars",
  "bomb",
  "burst",
  "car-side",
  "truck-pickup",
  "jet-fighter",
  "face-smile",
  "face-frown",
  "crosshairs",
  "flag",
  "flag-pennant",
  "gun",
  "sword",
  "shield",
  "tombstone",
  "tree",
  "gem",
  "coin",
  "box-open",
  "location-dot",
  "location-exclamation",
  "location-question",
  "map-pin",
  "person",
  "person-rifle",
  "skull-crossbones",
  "square",
  "triangle",
  "diamond",
  "circle",
  "circle-dashed",
  "circle-a",
  "circle-b",
  "circle-c",
  "circle-d",
  "circle-e",
  "circle-f",
  "circle-g",
  "circle-h",
  "circle-i",
  "circle-j",
  "circle-k",
  "circle-l",
  "circle-m",
  "circle-n",
  "circle-o",
  "circle-p",
  "circle-q",
  "circle-r",
  "circle-s",
  "circle-t",
  "circle-u",
  "circle-v",
  "circle-w",
  "circle-x",
  "circle-y",
  "circle-z",
  "circle-1",
  "circle-2",
  "circle-3",
  "circle-4",
  "circle-5",
  "circle-6",
  "circle-7",
  "circle-8",
  "circle-9",
]);

const HLL_IDS = new Set([
  "garrison",
  "airhead",
  "halftrack",
  "outpost",
  "recon-outpost",
  "forward",
  "tank-heavy",
  "tank-medium",
  "tank-light",
  "tank-recon",
  "jeep",
  "truck-supply",
  "truck-transport",
  "class-commander",
  "class-officer",
  "class-rifleman",
  "class-assault",
  "class-auto-rifleman",
  "class-medic",
  "class-support",
  "class-machine-gunner",
  "class-anti-tank",
  "class-engineer",
  "class-spotter",
  "class-sniper",
  "at-gun",
  "repair-station",
  "node-batch",
  "node-manpower",
  "node-munition",
  "node-fuel",
  "supplies-50",
  "supplies-50x2",
  "supplies-100",
  "supplies-150",
  "supplies-150x2",
  "box-ammo",
  "box-explosive",
  "box-bandage",
  "mine-at",
  "mine-ap",
  "arty-effect",
  "enemy-garrison",
  "enemy-infantry",
  "enemy-outpost",
  "enemy-tank",
  "enemy-vehicle",
  "supply-drop",
  "ammo-drop",
  "airhead-drop",
  "reinforce",
  "strafing-run",
  "bombing-run",
  "katyusha-strike",
]);

const COORD_MIN = -20;
const COORD_MAX = 120;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizePoint(point) {
  if (!point || typeof point !== "object") return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: clamp(x, COORD_MIN, COORD_MAX),
    y: clamp(y, COORD_MIN, COORD_MAX),
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
    if (Number.isFinite(Number(meta.ssIconId)) && Number(meta.ssIconId) > 19) {
      normalized.ssIconId = Number(meta.ssIconId);
    }
  }
  if (type === "hll") {
    normalized.hllId = HLL_IDS.has(meta.hllId) ? meta.hllId : "garrison";
    normalized.showRadius = meta.showRadius !== false;
  }
  return normalized;
}

export function normalizeStratObject(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;

  let type = STRAT_OBJECT_TYPES.includes(raw.type) ? raw.type : null;
  const id = String(raw.id || "").trim();
  if (!type || !id) return null;

  const wasArrow = type === "arrow";
  if (wasArrow) type = "line";

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

  const style = normalizeStyle(raw.style, wasArrow ? "arrow" : type);
  const meta = normalizeMeta(raw.meta, type);

  if (type === "curve") {
    if (points.length >= 4) {
      points = points.slice(0, 4);
    } else if (points.length >= 2) {
      const a = points[0];
      const b = points[points.length - 1];
      points = [
        a,
        {
          x: clamp(a.x + (b.x - a.x) / 3, COORD_MIN, COORD_MAX),
          y: clamp(a.y + (b.y - a.y) / 3, COORD_MIN, COORD_MAX),
        },
        {
          x: clamp(a.x + (2 * (b.x - a.x)) / 3, COORD_MIN, COORD_MAX),
          y: clamp(a.y + (2 * (b.y - a.y)) / 3, COORD_MIN, COORD_MAX),
        },
        b,
      ];
    } else {
      return null;
    }
  }

  // Icons / HLL markers use a 2-point bbox (like rect/ellipse); upgrade legacy center-only.
  if ((type === "icon" || type === "hll") && points.length === 1) {
    const p = points[0];
    let halfW = Math.max(0.9, (style.size || 3) * 0.275);
    let halfH = halfW;
    if (type === "hll") {
      // Approximate catalog defaults without bundling the full client catalog in Workers.
      halfW = meta.hllId === "garrison" && meta.showRadius !== false ? 9.9 : 1.3;
      halfH = halfW;
    }
    points = [
      { x: clamp(p.x - halfW, COORD_MIN, COORD_MAX), y: clamp(p.y - halfH, COORD_MIN, COORD_MAX) },
      { x: clamp(p.x + halfW, COORD_MIN, COORD_MAX), y: clamp(p.y + halfH, COORD_MIN, COORD_MAX) },
    ];
  } else if ((type === "icon" || type === "hll") && points.length > 2) {
    points = points.slice(0, 2);
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

export function sanitizeStratObjects(objects) {
  if (!Array.isArray(objects)) return [];
  return objects
    .map((object, index) => normalizeStratObject(object, index))
    .filter(Boolean)
    .slice(0, 500)
    .map((object, index) => ({ ...object, zIndex: index }));
}
