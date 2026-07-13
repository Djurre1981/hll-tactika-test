import { initAuth, loadMapMarkers } from "./ui/auth-gate.js";
import { applyMapBgFade } from "./ui/map-bg-fade.js";
import { state, loadSelectedMapId, saveSelectedMapId } from "./state.js";
import { initViewerPreferences, getViewerPreferences } from "./viewer-preferences.js";
import { setMapPickerValue } from "./ui/map-picker.js";
import { initPortraitPanelDefaults } from "./ui/chrome-panels.js";

function waitForImage(image) {
  if (image.complete && image.naturalWidth) return Promise.resolve();
  return new Promise((resolve) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", resolve, { once: true });
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

  initViewerPreferences(auth.user);
  const prefs = getViewerPreferences();
  state.tagFilters = { ...prefs.tagFilters };
  state.currentFaction = prefs.faction;
  state.mapLabelsVisible = prefs.mapLabels;
  state.previewEnabled = prefs.preview;

  const initialMapId = loadSelectedMapId("SMDMV2");
  const markerLoads = new Map();

  function rememberMarkerLoad(mapId, promise) {
    const tracked = promise
      .then((data) => {
        state.pinCatalog[mapId] = data.pins || [];
        return data;
      })
      .catch((error) => {
        markerLoads.delete(mapId);
        console.error(`Failed to load markers for ${mapId}:`, error);
        state.pinCatalog[mapId] = [];
        throw error;
      });
    markerLoads.set(mapId, tracked);
    return tracked;
  }

  async function ensureMapMarkers(mapId) {
    if (!markerLoads.has(mapId)) {
      rememberMarkerLoad(mapId, loadMapMarkers(mapId));
    }
    return markerLoads.get(mapId);
  }

  function resolveMapWithPins(requestedMapId, markerData) {
    if (markerData.pins?.length) {
      return requestedMapId;
    }
    const mapsWithPins = markerData.mapsWithPins || [];
    if (!mapsWithPins.length) {
      return requestedMapId;
    }
    if (mapsWithPins.includes(markerData.defaultMapId)) {
      return markerData.defaultMapId;
    }
    return mapsWithPins[0];
  }

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
    document.title = `HLL Tactika — ${map.name}`;

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
    const markerData = await ensureMapMarkers(mapId);
    let activeMapId = mapId;
    const resolvedMapId = resolveMapWithPins(mapId, markerData);
    if (resolvedMapId !== mapId) {
      activeMapId = resolvedMapId;
      state.currentMapId = activeMapId;
      const resolvedMap = state.mapCatalog.find((item) => item.id === activeMapId);
      if (resolvedMap) {
        state.currentMap = resolvedMap;
        saveSelectedMapId(activeMapId, resolvedMap.image);
        setMapPickerValue(activeMapId);
        const image = document.getElementById("map-image");
        const nextSrc = resolveImageSrc(resolvedMap.image);
        if (image.src !== nextSrc) {
          image.src = resolvedMap.image;
          await waitForImage(image);
        }
        image.alt = `${resolvedMap.name} tactical map`;
        document.title = `HLL Tactika — ${resolvedMap.name}`;
        state.mapOverlays.setMapData(resolvedMap);
        if (state.mapOverlays.syncGridSize) {
          state.mapOverlays.syncGridSize();
        }
      }
      await ensureMapMarkers(activeMapId);
    }
    state.pins = (state.pinCatalog[activeMapId] || []).map(normalizePin);
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
  state.currentMapId = initialMapId;

  const mapInitPromise = switchMap(initialMapId, { fit: true }).catch((error) => {
    console.error("Failed to initialize map:", error);
  });

  const [
    _adminPanelModule,
    { fetchMapMarkers },
    { populateMapSelect },
    { initUndoRedoKeyboard },
    { bindUi },
  ] = await restModulesPromise;

  async function reloadPinsForMap(mapId = state.currentMapId) {
    const data = await fetchMapMarkers(mapId);
    state.pinCatalog[mapId] = data.pins || [];
    state.pins = (state.pinCatalog[mapId] || []).map(normalizePin);
    renderPins();
    renderPinList();
  }

  populateMapSelect();
  applyTagFiltersToUi();
  applyFactionFiltersToUi();
  initUndoRedoKeyboard();
  bindUi({ reloadPinsForMap, switchMap });

  document.getElementById("app-root")?.classList.remove("is-auth-pending");

  await mapInitPromise;
  revealMapViewport();
}

init();
