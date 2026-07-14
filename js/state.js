import { createDefaultToolSettings } from "./helpers/strat-defaults.js";

export const state = {
  appMode: "viewer",
  pins: [],
  pinCatalog: {},
  mapCatalog: [],
  stratsCatalog: [],
  activeStrat: null,
  activeSlideId: null,
  stratsPanelView: "slides",
  pendingDuplicateSlideId: null,
  stratsToolSettings: createDefaultToolSettings(),
  stratsSaveInFlight: false,
  stratsDirty: false,
  stratsUndoStack: [],
  stratsRedoStack: [],
  currentMapId: "SMDMV2",
  currentMap: null,
  editMode: false,
  panelMode: null,
  editingPinId: null,
  modalPin: null,
  modalMediaIndex: 0,
  pendingCoords: null,
  pendingDirection: null,
  highlightedPinId: null,
  phonePreviewPinId: null,
  contextMenuPin: null,
  currentFaction: "neutral",
  pendingFaction: "neutral",
  pendingTag: "mg-spot",
  searchQuery: "",
  previewHideTimer: null,
  positionHistory: [],
  redoHistory: [],
  pinDragSession: null,
  pinSaveInFlight: false,
  addPinSession: false,
  mgCollapseHint: false,
  mapViewer: null,
  mapOverlays: null,
  previewEnabled: true,
  mapLabelsVisible: true,
};

export const MAP_STORAGE_KEY = "hll-tactika-selected-map";
export const MAP_IMAGE_STORAGE_KEY = "hll-tactika-selected-map-image";
export const TOGGLE_STORAGE_KEY = "hll-tactika-overlay-toggles";
export const TAG_FILTER_STORAGE_KEY = "hll-tactika-tag-filters";
export const FACTION_FILTER_STORAGE_KEY = "hll-tactika-faction-filters";

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private browsing / quota */
  }
}

export function loadSelectedMapId(fallbackId) {
  const stored = safeGetItem(MAP_STORAGE_KEY);
  return stored || fallbackId || "SMDMV2";
}

export function loadSelectedMapImage(fallbackId) {
  const stored = safeGetItem(MAP_IMAGE_STORAGE_KEY);
  if (stored) return stored;
  const mapId = loadSelectedMapId(fallbackId);
  return `maps/no-grid/${mapId}_NoGrid.webp`;
}

export function saveSelectedMapId(mapId, mapImage) {
  safeSetItem(MAP_STORAGE_KEY, mapId);
  if (mapImage) {
    safeSetItem(MAP_IMAGE_STORAGE_KEY, mapImage);
  }
}

export function loadToggleState() {
  try {
    return JSON.parse(safeGetItem(TOGGLE_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveToggleState(toggleState) {
  safeSetItem(TOGGLE_STORAGE_KEY, JSON.stringify(toggleState));
}
