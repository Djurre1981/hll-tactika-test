import { state } from "./state.js";
import { canModifyPin, canEnterEditorMode } from "./helpers/permissions.js";
import { persistToggles, persistBgHue, persistBgRandom, setMapLabelsVisible } from "./ui/toggles.js";
import { hidePreviewImmediately, scheduleHidePreview, initPreviewTooltip } from "./ui/pin-preview.js";
import { isPhoneLayout } from "./helpers/layout.js";
import {
  backToEditorBrowse,
  tryBackToEditorBrowse,
  openAddPinForm,
  startEditPin,
} from "./ui/pin-editor.js";
import {
  onDeletePin,
  onDeleteAddPinPlacement,
  initRequiresCheckboxes,
  initAutoSave,
  updateFactionRequires,
} from "./editor/form-handler.js";
import { initPinMediaForm } from "./editor/media-form.js";
import {
  onPinContextMenuAction,
  hidePinContextMenu,
  onContextMenuKeyDown,
  handleEditorPlacementContextMenu,
} from "./ui/pin-context-menu.js";
import { closeModal, handleModalCloseEvent, initModalMediaNav } from "./ui/pin-modal.js";
import {
  onViewportClick,
  onViewportContextMenu,
  onViewportMouseMove,
  onViewportMouseLeave,
} from "./editor/placement-mode.js";
import { updateDraftMarker } from "./editor/draft-renderer.js";
import { initMapPicker } from "./ui/map-picker.js";
import { renderPins } from "./ui/pin-marker.js";
import { renderPinList } from "./ui/sidebar.js";
import {
  saveTagFilters,
  applyTagFiltersToUi,
  applyFactionFiltersToUi,
  applyEditorFactionToUi,
  saveCurrentFaction,
  getFilteredPins,
} from "./ui/filter-bar.js";
import { highlightPin, focusPendingPlacement } from "./helpers/proximity.js";
import { initDraftPinDrag } from "./editor/pin-drag.js";
import { initMapColorControl } from "./ui/map-bg-fade.js";
import { setShellCollapsed } from "./ui/chrome-panels.js";
import { setAppMode } from "./ui/app-mode.js";

function suppressNativeContextMenu(elements) {
  for (const element of elements) {
    if (!element) continue;
    element.addEventListener(
      "contextmenu",
      (event) => {
        event.preventDefault();
      },
      { capture: true }
    );
  }
}

function onTagFiltersChanged() {
  if (state.highlightedPinId && !getFilteredPins().some((pin) => pin.id === state.highlightedPinId)) {
    highlightPin(null);
  }
  renderPins();
  renderPinList();
}

function onViewportBackgroundTap(event) {
  if (!isPhoneLayout() || state.panelMode !== null) return;
  if (event.target.closest(".map-pin, .map-mg-spot, .map-pin__label")) return;
  if (!state.highlightedPinId && !state.phonePreviewPinId) return;
  state.phonePreviewPinId = null;
  scheduleHidePreview();
  highlightPin(null);
}

export function bindUi({ reloadPinsForMap, switchMap }) {
  suppressNativeContextMenu([
    document.getElementById("map-viewport"),
    document.getElementById("sidebar"),
    document.getElementById("mode-switch"),
    document.getElementById("user-cluster"),
    document.getElementById("pin-context-menu"),
  ]);

  const toolbarShell = document.getElementById("map-toolbar-shell");
  const toolbarToggle = document.getElementById("btn-map-toolbar-toggle");
  toolbarToggle?.addEventListener("click", () => {
    const collapsed = !toolbarShell.classList.contains("is-collapsed");
    setShellCollapsed(toolbarShell, toolbarToggle, collapsed, {
      show: "Show toolbar",
      hide: "Hide toolbar",
    });
  });

  const sidebarShell = document.getElementById("sidebar-shell");
  const sidebarToggle = document.getElementById("btn-sidebar-toggle");
  sidebarToggle?.addEventListener("click", () => {
    const collapsed = !sidebarShell.classList.contains("is-collapsed");
    setShellCollapsed(sidebarShell, sidebarToggle, collapsed, {
      show: "Show sidebar",
      hide: "Hide sidebar",
    });
    state.mapViewer?.followSidebarLayout();
  });

  document.getElementById("btn-zoom-in").addEventListener("click", () => state.mapViewer?.zoomIn());
  document.getElementById("btn-zoom-out").addEventListener("click", () => state.mapViewer?.zoomOut());
  document.getElementById("zoom-label").addEventListener("click", () => state.mapViewer?.resetView());
  document.getElementById("btn-reset-view")?.addEventListener("click", () => state.mapViewer?.resetView());

  const modeSwitch = document.getElementById("mode-switch");
  modeSwitch?.querySelector('[data-mode="viewer"]')?.addEventListener("click", () => {
    if (state.toolRoute === "stratmaker") return;
    void setAppMode("viewer");
  });
  modeSwitch?.querySelector('[data-mode="editor"]')?.addEventListener("click", () => {
    if (state.toolRoute === "stratmaker") return;
    if (!canEnterEditorMode()) return;
    void setAppMode("editor");
  });
  modeSwitch?.querySelector('[data-mode="strats"]')?.addEventListener("click", () => {
    // Strats lives on /tool/stratmaker; guide page keeps Viewer/Editor only.
    return;
  });

  document.getElementById("btn-add-mg")?.addEventListener("click", () => openAddPinForm("mg-spot"));
  document.getElementById("btn-add-climb")?.addEventListener("click", () => openAddPinForm("climb"));
  document.getElementById("btn-edit-panel-back")?.addEventListener("click", async () => {
    const backBtn = document.getElementById("btn-edit-panel-back");
    if (backBtn?.disabled) return;
    if (backBtn) backBtn.disabled = true;
    try {
      await tryBackToEditorBrowse();
    } finally {
      if (backBtn) backBtn.disabled = false;
    }
  });

  document.addEventListener("pin-list-edit", (event) => {
    const pin = state.pins.find((item) => item.id === event.detail?.pinId);
    if (pin) startEditPin(pin);
  });

  const pinContextMenu = document.getElementById("pin-context-menu");
  pinContextMenu?.addEventListener("click", (event) => {
    onPinContextMenuAction(event, {
      canModifyFn: canModifyPin,
      reloadPinsForMapFn: reloadPinsForMap,
      startEditPinFn: startEditPin,
      deleteEditPinFn: () => onDeletePin({
        reloadPinsForMap,
        backToEditorBrowse,
        canModifyFn: canModifyPin,
      }),
      deleteAddPinPlacementFn: () => onDeleteAddPinPlacement({
        reloadPinsForMap,
        canModifyFn: canModifyPin,
      }),
    });
  });

  const autoSaveDeps = {
    reloadPinsForMap,
    backToEditorBrowse,
    canModifyFn: canModifyPin,
  };

  document.addEventListener("click", (event) => {
    if (pinContextMenu && !pinContextMenu.contains(event.target)) {
      hidePinContextMenu();
    }
  });
  document.addEventListener("keydown", onContextMenuKeyDown);

  document.getElementById("btn-close-modal").addEventListener("click", closeModal);

  const modal = document.getElementById("video-modal");
  modal?.addEventListener("close", handleModalCloseEvent);

  const pinForm = document.getElementById("pin-form");
  pinForm?.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  const viewport = document.getElementById("map-viewport");
  viewport.addEventListener("click", (event) => {
    onViewportBackgroundTap(event);
    onViewportClick(event);
  });
  viewport.addEventListener("contextmenu", (event) => {
    if (handleEditorPlacementContextMenu(event)) return;
    onViewportContextMenu(event);
  });
  viewport.addEventListener("mousemove", onViewportMouseMove);
  viewport.addEventListener("mouseleave", onViewportMouseLeave);

  initMapPicker((mapId) => switchMap(mapId, { fit: true }));

  const pinSearch = document.getElementById("pin-search");
  pinSearch.addEventListener("input", (event) => {
    state.searchQuery = event.target.value;
    renderPins();
    renderPinList();
  });

  const toggleGrid = document.getElementById("toggle-grid");
  toggleGrid?.addEventListener("change", () => {
    state.mapOverlays?.setToggle("grid", toggleGrid.checked);
    persistToggles();
  });

  const toggleSp = document.getElementById("toggle-strongpoints");
  toggleSp?.addEventListener("change", () => {
    state.mapOverlays?.setToggle("strongpoints", toggleSp.checked);
    persistToggles();
  });

  const togglePreview = document.getElementById("toggle-preview");
  togglePreview?.addEventListener("change", () => {
    state.previewEnabled = togglePreview.checked;
    if (!togglePreview.checked) hidePreviewImmediately();
    persistToggles();
  });

  initMapColorControl({ persistToggles, persistBgHue, persistBgRandom });

  document.getElementById("btn-toggle-map-labels")?.addEventListener("click", () => {
    setMapLabelsVisible(!state.mapLabelsVisible);
    persistToggles();
  });

  document.querySelectorAll("#tag-filters [data-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      const tagId = button.dataset.tag;
      state.tagFilters[tagId] = !(state.tagFilters[tagId] !== false);
      saveTagFilters();
      applyTagFiltersToUi();
      onTagFiltersChanged();
    });
  });

  document.querySelectorAll("#sidebar-faction-bar [data-faction]").forEach((button) => {
    button.addEventListener("click", () => {
      const faction = button.dataset.faction;
      if (faction === state.currentFaction) return;
      state.currentFaction = faction;
      saveCurrentFaction();
      applyFactionFiltersToUi();
      renderPins();
      renderPinList();
    });
  });

  document.querySelectorAll("#edit-faction-bar [data-faction]").forEach((button) => {
    button.addEventListener("click", () => {
      const faction = button.dataset.faction;
      if (faction === state.pendingFaction || (state.panelMode !== "add" && state.panelMode !== "edit")) return;
      state.pendingFaction = faction;
      applyEditorFactionToUi();
      updateFactionRequires(faction);
      updateDraftMarker();
    });
  });

  document.getElementById("pin-coords")?.addEventListener("click", () => {
    focusPendingPlacement();
  });

  initRequiresCheckboxes();
  initAutoSave(autoSaveDeps);
  initPinMediaForm();
  initModalMediaNav();
  initPreviewTooltip();
  initDraftPinDrag();
}
