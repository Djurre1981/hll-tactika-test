import { enterApp, initToolAuth } from "../ui/auth-gate.js";
import { markAppBootstrapped, setEnterAppModeHandler } from "../ui/dashboard.js";
import { applyMapBgFade } from "../ui/map-bg-fade.js";
import { state, loadSelectedMapId, saveSelectedMapId } from "../state.js";
import { initViewerPreferences, getViewerPreferences } from "../viewer-preferences.js";
import { setMapPickerValue } from "../ui/map-picker.js";
import { initPortraitPanelDefaults } from "../ui/chrome-panels.js";
import {
  dropMapThumbnailCache,
  warmMapThumbnails,
} from "../helpers/thumbnail-cache.js";
import { assetUrl } from "../helpers/asset-url.js";
import { go, ROUTES } from "../ui/router.js";
import { waitForImage, resolveImageSrc, ensureMapMarkers, resolveMapWithPins } from "./map-loader.js";

export async function bootToolApp({ tool = "climbing-guide" } = {}) {
  const mapsModulePromise = import("../api/maps.js");
  const mapModulesPromise = Promise.all([
    import("../ui/map-viewer.js"),
    import("../ui/map-overlays.js"),
    mapsModulePromise,
    import("../ui/filter-bar.js"),
    import("../ui/pin-marker.js"),
    import("../ui/sidebar.js"),
    import("../ui/pin-editor.js"),
    import("../ui/app-mode.js"),
    import("../ui/toggles.js"),
  ]);
  const coreUiPromise = Promise.all([
    import("../api/pins.js"),
    import("../ui/map-picker.js"),
    import("../editor/undo-redo.js"),
    import("../bind-ui.js"),
  ]);
  const restModulesPromise = Promise.all([
    import("../ui/admin-panel.js"),
    coreUiPromise,
  ]);
  const spawnPromise = mapsModulePromise.then(({ loadSpawnData }) => loadSpawnData());
  const adminPanelPromise = import("../ui/admin-panel.js");

  const enterMode = "viewer";
  const auth = await initToolAuth({ tool, enterMode });
  if (!auth.ok) return;

  initViewerPreferences(auth.user);
  const prefs = getViewerPreferences();
  state.tagFilters = { ...prefs.tagFilters };
  state.currentFaction = prefs.faction;
  state.mapLabelsVisible = prefs.mapLabels;
  state.previewEnabled = prefs.preview;

  document.getElementById("app-root")?.classList.add("is-auth-pending");
  enterApp(enterMode);

  const initialMapId = loadSelectedMapId("SMDMV2");

  const { initAdminPanel } = await adminPanelPromise;
  initAdminPanel();
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
      { setAppMode, syncAppModeChrome },
      { applyToggleStateToUi, applyToggleStateToOverlays },
    ],
    spawnData,
  ] = await Promise.all([mapModulesPromise, spawnPromise]);

  async function switchMap(mapId, { fit = false, resolveIfEmpty = false } = {}) {
    const map = state.mapCatalog.find((item) => item.id === mapId);
    if (!map) return;

    const previousMapId = state.currentMapId;
    if (previousMapId && previousMapId !== mapId) {
      dropMapThumbnailCache(previousMapId);
    }

    applyMapBgFade();

    const exited = await exitEditorMode();
    if (exited === false) {
      return;
    }
    if (state.appMode === "editor") {
      await setAppMode("viewer");
    }

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
      image.src = assetUrl(map.image);
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
    const resolvedMapId = resolveIfEmpty
      ? resolveMapWithPins(mapId, markerData)
      : mapId;
    if (resolvedMapId !== mapId) {
      if (mapId !== resolvedMapId) {
        dropMapThumbnailCache(mapId);
      }
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
          image.src = assetUrl(resolvedMap.image);
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

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void warmMapThumbnails(activeMapId, state.pins);
      });
    });
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

  const mapInitPromise = switchMap(initialMapId, { fit: true, resolveIfEmpty: true }).catch((error) => {
    console.error("Failed to initialize map:", error);
  });

  const [
    _adminPanelModule,
    [
      { fetchMapMarkers },
      { populateMapSelect },
      { initUndoRedoKeyboard },
      { bindUi },
    ],
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
  state.toolRoute = tool;
  syncAppModeChrome();
  bindUi({ reloadPinsForMap, switchMap });

  await setAppMode("viewer");

  document.getElementById("app-root")?.classList.remove("is-auth-pending");
  document.getElementById("app-root")?.setAttribute("data-ready", "1");
  markAppBootstrapped();

  setEnterAppModeHandler(async (mode) => {
    if (mode === "strats") {
      go(ROUTES.HOME);
      return;
    }
    enterApp(mode);
    await setAppMode(mode);
  });

  await mapInitPromise;
  revealMapViewport();
}
