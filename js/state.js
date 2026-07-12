export const state = {
  pins: [],
  pinCatalog: {},
  mapCatalog: [],
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

export function loadSelectedMapId(fallbackId) {
  const stored = localStorage.getItem(MAP_STORAGE_KEY);
  return stored || fallbackId || "SMDMV2";
}

export function loadSelectedMapImage(fallbackId) {
  const stored = localStorage.getItem(MAP_IMAGE_STORAGE_KEY);
  if (stored) return stored;
  const mapId = loadSelectedMapId(fallbackId);
  return `maps/no-grid/${mapId}_NoGrid.webp`;
}

export function saveSelectedMapId(mapId, mapImage) {
  localStorage.setItem(MAP_STORAGE_KEY, mapId);
  if (mapImage) {
    localStorage.setItem(MAP_IMAGE_STORAGE_KEY, mapImage);
  }
}

export function loadToggleState() {
  try {
    return JSON.parse(localStorage.getItem(TOGGLE_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveToggleState(toggleState) {
  localStorage.setItem(TOGGLE_STORAGE_KEY, JSON.stringify(toggleState));
}
