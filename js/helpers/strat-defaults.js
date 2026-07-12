import { state } from "../state.js";

export const STRAT_TEAMS = ["jr", "sr"];
export const STRAT_TYPES = ["friendly", "tournament"];

export const STRAT_ICON_OPTIONS = [
  { id: "check", icon: "fa-check" },
  { id: "xmark", icon: "fa-xmark" },
  { id: "circle-question", icon: "fa-circle-question" },
  { id: "circle-info", icon: "fa-circle-info" },
  { id: "triangle-exclamation", icon: "fa-triangle-exclamation" },
  { id: "house", icon: "fa-house" },
  { id: "ban", icon: "fa-ban" },
  { id: "binoculars", icon: "fa-binoculars" },
  { id: "bomb", icon: "fa-bomb" },
  { id: "car-side", icon: "fa-car-side" },
  { id: "truck-pickup", icon: "fa-truck-pickup" },
  { id: "jet-fighter", icon: "fa-jet-fighter" },
  { id: "crosshairs", icon: "fa-crosshairs" },
  { id: "flag", icon: "fa-flag" },
  { id: "gun", icon: "fa-gun" },
  { id: "shield", icon: "fa-shield" },
  { id: "skull-crossbones", icon: "fa-skull-crossbones" },
  { id: "person-rifle", icon: "fa-person-rifle" },
  { id: "map-pin", icon: "fa-map-pin" },
  { id: "location-dot", icon: "fa-location-dot" },
];

export const STRAT_COLOR_PRESETS = [
  "#ffffff",
  "#ff4444",
  "#44aaff",
  "#ffcc00",
  "#44dd66",
  "#ff8800",
  "#c084fc",
  "#111111",
];

export function createDefaultToolSettings() {
  return {
    activeTool: "select",
    color: "#ffffff",
    size: 3,
    lineType: "solid",
    endType: "none",
    filled: true,
    fontSize: 10,
    textStyle: 0,
    textAlign: "center",
    iconId: "check",
    iconLabel: "",
  };
}

export function createSlide({ mapId, order, name } = {}) {
  return {
    id: `slide-${crypto.randomUUID()}`,
    name: name || "Untitled",
    order: order ?? 0,
    mapId: mapId || state.currentMapId,
    objects: [],
  };
}

export function createStrat({ title, team, type, mapId } = {}) {
  const slide = createSlide({ mapId, order: 0 });
  const now = new Date().toISOString();
  return {
    id: `strat-${crypto.randomUUID()}`,
    title: title || "Untitled Strat",
    tags: {
      team: STRAT_TEAMS.includes(team) ? team : "jr",
      type: STRAT_TYPES.includes(type) ? type : "friendly",
    },
    notes: "",
    slides: [slide],
    locked: false,
    lockedBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getActiveSlide(strat, slideId) {
  if (!strat?.slides?.length) {
    return null;
  }
  return strat.slides.find((slide) => slide.id === slideId) || strat.slides[0];
}

export function sortSlides(slides) {
  return [...slides].sort((a, b) => a.order - b.order);
}
