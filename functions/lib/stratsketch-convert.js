import { sanitizeStratObjects } from "./strat-objects.js";

const HLL_MAP_LOOKUP = {
  carentan: "Carentan",
  foy: "Foy",
  hill400: "Hill400",
  hurtgen: "HurtgenV2",
  kursk: "Kursk",
  phl: "PHL",
  remagen: "Remagen",
  smdm: "SMDMV2",
  sme: "SME",
  stalingrad: "Stalingrad",
  utah: "Utah",
  omaha: "Omaha",
  kharkov: "Kharkov",
  driel: "Driel",
  el_alamein: "ElAlamein",
  mortain: "Mortain",
  elsenborn_ridge: "Elsenborn",
  tobruk: "Tobruk",
};

const SS_ICON_LOOKUP = {
  0: "check",
  1: "xmark",
  2: "circle-question",
  3: "circle-info",
  4: "triangle-exclamation",
  5: "house",
  6: "ban",
  7: "binoculars",
  8: "bomb",
  9: "car-side",
  10: "truck-pickup",
  11: "jet-fighter",
  12: "crosshairs",
  13: "flag",
  14: "gun",
  15: "shield",
  16: "skull-crossbones",
  17: "person-rifle",
  18: "map-pin",
  19: "location-dot",
};

function abs(position, relative = { x: 0, y: 0 }) {
  return {
    x: (position.x + relative.x) * 100,
    y: (position.y + relative.y) * 100,
  };
}

function absPoint(position) {
  return abs(position);
}

function makeObject(type, { points, style, meta = {} }) {
  return {
    id: `obj-${crypto.randomUUID()}`,
    type,
    points,
    style,
    meta,
  };
}

export function mapStratSketchMapName(mapName, fallbackMapId = "SMDMV2") {
  if (!mapName || mapName === "custom") return fallbackMapId;
  return HLL_MAP_LOOKUP[mapName] || fallbackMapId;
}

function convertPen(entity) {
  const points = entity.points.map((point) => abs(entity.position, point));
  if (points.length < 2) return null;
  return makeObject("pen", {
    points,
    style: {
      color: entity.settings.color,
      size: entity.settings.size,
      lineType: entity.settings.lineType,
      endType: entity.settings.endType,
    },
  });
}

function convertLine(entity, { arrow = false } = {}) {
  const points = [
    abs(entity.position, entity.start),
    abs(entity.position, entity.end),
  ];
  const endType = arrow
    ? entity.settings.endType === "none" ? "end" : entity.settings.endType
    : entity.settings.endType || "none";
  return makeObject("line", {
    points,
    style: {
      color: entity.settings.color,
      size: entity.settings.size,
      lineType: entity.settings.lineType,
      endType,
    },
  });
}

function convertCircle(entity) {
  const center = absPoint(entity.position);
  const radius = entity.radius * 100;
  return makeObject("ellipse", {
    points: [
      { x: center.x - radius, y: center.y - radius },
      { x: center.x + radius, y: center.y + radius },
    ],
    style: {
      color: entity.settings.color,
      size: entity.settings.size,
      lineType: entity.settings.lineType,
      filled: entity.settings.filled,
    },
  });
}

function convertRectangle(entity) {
  const anchor = absPoint(entity.position);
  return makeObject("rect", {
    points: [
      anchor,
      { x: anchor.x + entity.width * 100, y: anchor.y + entity.height * 100 },
    ],
    style: {
      color: entity.settings.color,
      size: entity.settings.size,
      lineType: entity.settings.lineType,
      filled: entity.settings.filled,
    },
  });
}

function convertPolygon(entity) {
  const points = entity.points.map((point) => abs(entity.position, point));
  if (points.length < 2) return null;
  return makeObject("pen", {
    points: [...points, points[0]],
    style: {
      color: entity.settings.color,
      size: entity.settings.size,
      lineType: entity.settings.lineType,
      filled: entity.settings.filled,
    },
  });
}

function convertText(entity) {
  return makeObject("text", {
    points: [abs(entity.position)],
    style: {
      color: entity.settings.color,
      fontSize: entity.settings.fontSize,
      textStyle: entity.settings.textStyle,
      textAlign: entity.settings.textAlign,
    },
    meta: { text: entity.text || "" },
  });
}

function convertIcon(entity) {
  const iconId = entity.settings.iconId;
  const meta = { iconLabel: entity.label || "" };
  if (Number(iconId) > 19) {
    meta.ssIconId = iconId;
    meta.iconId = "check";
  } else {
    meta.iconId = SS_ICON_LOOKUP[iconId] || "check";
  }
  return makeObject("icon", {
    points: [absPoint(entity.position)],
    style: {
      color: entity.settings.color,
      size: 3,
    },
    meta,
  });
}

export function convertStratSketchEntity(entity) {
  switch (entity.kind) {
    case "pen":
      return convertPen(entity);
    case "line":
      return convertLine(entity, { arrow: entity.settings.endType !== "none" });
    case "circle":
      return convertCircle(entity);
    case "rectangle":
      return convertRectangle(entity);
    case "polygon":
      return convertPolygon(entity);
    case "text":
      return convertText(entity);
    case "icon":
      return convertIcon(entity);
    default:
      return null;
  }
}

export function convertStratSketchBriefing(briefing, { defaultMapId = "SMDMV2" } = {}) {
  const slides = (briefing.slides || []).map((slide, order) => ({
    id: `slide-${crypto.randomUUID()}`,
    name: slide.name || `Slide ${order + 1}`,
    order,
    mapId: mapStratSketchMapName(slide.mapName, defaultMapId),
    objects: sanitizeStratObjects(
      (slide.entities || [])
        .map((entity) => convertStratSketchEntity(entity))
        .filter(Boolean)
    ),
  }));

  return {
    title: briefing.name || "Imported Strat",
    notes: "Imported from StratSketch",
    tags: { team: "jr", type: "friendly" },
    slides: slides.length > 0 ? slides : [{
      id: `slide-${crypto.randomUUID()}`,
      name: "Slide 1",
      order: 0,
      mapId: defaultMapId,
      objects: [],
    }],
  };
}
