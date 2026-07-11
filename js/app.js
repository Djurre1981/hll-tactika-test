import { initAuth, loadProtectedPins } from "./ui/auth-gate.js";
import { applyMapBgFade, initMapColorControl, restoreMapBgFadeSettings } from "./ui/map-bg-fade.js";
import { state, loadSelectedMapId, saveSelectedMapId, loadToggleState } from "./state.js";
import { setMapPickerValue } from "./ui/map-picker.js";
import { loadTagFilters, loadCurrentFaction } from "./ui/filter-bar.js";
import { initPortraitPanelDefaults } from "./ui/chrome-panels.js";

function waitForImage(image) {
  if (image.complete && image.naturalWidth) return Promise.resolve();
  return new Promise((resolve) => {
    image.addEventListener("load", resolve, { once: true });
  });
}

function resolveImageSrc(imagePath) {
  return new URL(imagePath, window.location.href).href;
}

function revealAppChrome() {
  document.getElementById("mode-switch")?.classList.remove("hidden");
  document.getElementById("user-cluster")?.classList.remove("hidden");
}

async function init() {
  state.tagFilters = loadTagFilters();
  state.currentFaction = loadCurrentFaction();

  const savedToggles = loadToggleState();
  restoreMapBgFadeSettings({
    enabled: savedToggles.bgColor ?? true,
    hue: savedToggles.bgHue ?? null,
    random: savedToggles.bgRandom ?? savedToggles.bgHue == null,
  });

  const mapsModulePromise = import("./api/maps.js");
  const mapModulesPromise = Promise.all([
    import("./ui/map-viewer.js"),
    import("./ui/map-overlays.js"),
    mapsModulePromise,
    import("./ui/filter-bar.js"),
    import("./ui/pin-marker.js"),
    import("./ui/sidebar.js"),
    import("./ui/pin-editor.js"),
    import("./ui/toggles.js"),
  ]);
  const restModulesPromise = Promise.all([
    import("./ui/admin-panel.js"),
    import("./api/pins.js"),
    import("./ui/map-picker.js"),
    import("./editor/undo-redo.js"),
    import("./bind-ui.js"),
  ]);
  const spawnPromise = mapsModulePromise.then(({ loadSpawnData }) => loadSpawnData());
  const adminPanelPromise = import("./ui/admin-panel.js");

  const auth = await initAuth();
  if (!auth.ok) return;

  const pinDataPromise = loadProtectedPins();
  const { initAdminPanel } = await adminPanelPromise;
  initAdminPanel();
  revealAppChrome();
  initPortraitPanelDefaults();

  const [
    [
      { MapViewer },
      { MapOverlays },
      _mapsModule,
      {
        applyTagFiltersToUi,
        applyFactionFiltersToUi,
        normalizePin,
      },
      { renderPins },
      { renderPinList },
      { exitEditorMode, updateZoomLabel },
      { applyToggleStateToUi, applyToggleStateToOverlays },
    ],
    spawnData,
  ] = await Promise.all([mapModulesPromise, spawnPromise]);

  async function switchMap(mapId, { fit = false } = {}) {
    const map = state.mapCatalog.find((item) => item.id === mapId);
    if (!map) return;

    applyMapBgFade();

    exitEditorMode();

    state.searchQuery = "";
    const searchEl = document.getElementById("pin-search");
    if (searchEl) searchEl.value = "";

    state.currentMapId = mapId;
    state.currentMap = map;
    saveSelectedMapId(mapId, map.image);

    setMapPickerValue(mapId);

    const image = document.getElementById("map-image");
    const nextSrc = resolveImageSrc(map.image);
    if (image.src !== nextSrc) {
      image.src = map.image;
      await waitForImage(image);
    } else if (!image.complete || !image.naturalWidth) {
      await waitForImage(image);
    }
    image.alt = `${map.name} tactical map`;
    document.title = `HLL Climb Guide — ${map.name}`;

    if (!state.mapViewer) {
      const viewport = document.getElementById("map-viewport");
      const stage = document.getElementById("map-stage");
      state.mapViewer = new MapViewer(viewport, stage, image);
      state.mapViewer.onTransform = () => {
        updateZoomLabel();
      };
      state.mapOverlays = new MapOverlays(stage, image);
      applyToggleStateToUi();
      applyToggleStateToOverlays();
    } else {
      state.mapOverlays.syncGridSize();
    }

    state.mapOverlays.setMapData(map);
    state.pins = (state.pinCatalog[mapId] || []).map(normalizePin);
    renderPins();
    renderPinList();

    if (fit) {
      state.mapViewer.fitToView();
    } else {
      state.mapViewer.clampTranslation();
      state.mapViewer.applyTransform();
    }
  }

  function revealMapViewport() {
    const viewport = document.getElementById("map-viewport");
    if (!viewport?.classList.contains("is-booting")) return;

    requestAnimationFrame(() => {
      state.mapViewer?.fitToView();
      viewport.classList.remove("is-booting");
    });
  }

  state.mapCatalog = spawnData.maps || [];
  state.pinCatalog = {};
  state.pins = [];
  state.currentMapId = loadSelectedMapId("SMDMV2");

  await switchMap(state.currentMapId, { fit: true });

  let pinData;
  try {
    pinData = await pinDataPromise;
  } catch {
    revealMapViewport();
    return;
  }

  state.pinCatalog = pinData.pins || {};
  const resolvedMapId = loadSelectedMapId(pinData.defaultMapId);
  if (resolvedMapId !== state.currentMapId) {
    state.currentMapId = resolvedMapId;
    await switchMap(state.currentMapId, { fit: true });
  } else {
    state.pins = (state.pinCatalog[state.currentMapId] || []).map(normalizePin);
    renderPins();
    renderPinList();
  }

  revealMapViewport();

  const [
    _adminPanelModule,
    { fetchPinsCatalog },
    { populateMapSelect },
    { initUndoRedoKeyboard },
    { bindUi },
  ] = await restModulesPromise;

  async function reloadPinsForMap(mapId = state.currentMapId) {
    const data = await fetchPinsCatalog();
    state.pinCatalog = data.pins || {};
    state.pins = (state.pinCatalog[mapId] || []).map(normalizePin);
    renderPins();
    renderPinList();
  }

  populateMapSelect();
  applyTagFiltersToUi();
  applyFactionFiltersToUi();
  initUndoRedoKeyboard();
  bindUi({ reloadPinsForMap, switchMap });
}

init();
