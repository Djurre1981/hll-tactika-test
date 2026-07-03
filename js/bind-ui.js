import { state } from "./state.js";
import { canModifyPin } from "./helpers/permissions.js";
import { persistToggles, persistBgHue, persistBgRandom } from "./ui/toggles.js";
import { hidePreviewImmediately } from "./ui/pin-preview.js";
import {
  toggleEditMode,
  exitEditorMode,
  backToEditorBrowse,
  openAddPinForm,
  startEditPin,
} from "./ui/pin-editor.js";
import {
  onSavePin,
  triggerFormSave,
  initRequiresCheckboxes,
  updateFactionRequires,
} from "./editor/form-handler.js";
import { initPinMediaForm } from "./editor/media-form.js";
import {
  onPinContextMenuAction,
  hidePinContextMenu,
  onContextMenuKeyDown,
} from "./ui/pin-context-menu.js";
import {
  onFormContextMenuAction,
  hideFormContextMenu,
} from "./ui/form-context-menu.js";
import { closeModal, clearModalPlayer, initModalMediaNav } from "./ui/pin-modal.js";
import {
  setPinFormTag,
  getPlacementHint,
  updatePlacementUi,
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
import { highlightPin } from "./helpers/proximity.js";
import { isDirectionalPinTag } from "./pin-tags.js";
import { initDraftPinDrag } from "./editor/pin-drag.js";
import { initMapColorControl } from "./ui/map-bg-fade.js";

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

export function bindUi({ reloadPinsForMap, switchMap }) {
  suppressNativeContextMenu([
    document.getElementById("map-viewport"),
    document.getElementById("sidebar"),
    document.getElementById("app-chrome"),
    document.getElementById("pin-context-menu"),
    document.getElementById("form-context-menu"),
  ]);

  document.getElementById("btn-zoom-in").addEventListener("click", () => state.mapViewer?.zoomIn());
  document.getElementById("btn-zoom-out").addEventListener("click", () => state.mapViewer?.zoomOut());
  document.getElementById("zoom-label").addEventListener("click", () => state.mapViewer?.resetView());
  document.getElementById("btn-reset-view")?.addEventListener("click", () => state.mapViewer?.resetView());

  const modeSwitch = document.getElementById("mode-switch");
  modeSwitch?.querySelector('[data-mode="viewer"]')?.addEventListener("click", () => {
    if (state.panelMode !== null) exitEditorMode();
  });
  modeSwitch?.querySelector('[data-mode="editor"]')?.addEventListener("click", () => {
    if (state.panelMode === null) toggleEditMode();
  });

  document.getElementById("btn-add-pin").addEventListener("click", () => openAddPinForm());
  document.getElementById("btn-edit-panel-back").addEventListener("click", () => backToEditorBrowse());

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
    });
  });

  const formContextMenu = document.getElementById("form-context-menu");
  const formSaveDeps = {
    reloadPinsForMap,
    backToEditorBrowse,
    canModifyFn: canModifyPin,
  };
  formContextMenu?.addEventListener("click", (event) => {
    onFormContextMenuAction(event, {
      triggerFormSaveFn: () => triggerFormSave(formSaveDeps),
    });
  });

  document.addEventListener("click", (event) => {
    if (pinContextMenu && !pinContextMenu.contains(event.target)) {
      hidePinContextMenu();
    }
    if (formContextMenu && !formContextMenu.contains(event.target)) {
      hideFormContextMenu();
    }
  });
  document.addEventListener("keydown", onContextMenuKeyDown);

  document.getElementById("btn-close-modal").addEventListener("click", closeModal);

  const modal = document.getElementById("video-modal");
  modal?.addEventListener("close", clearModalPlayer);

  const pinForm = document.getElementById("pin-form");
  pinForm?.addEventListener("submit", (event) => {
    onSavePin(event, {
      reloadPinsForMap,
      backToEditorBrowse,
      canModifyFn: canModifyPin,
    });
  });

  const viewport = document.getElementById("map-viewport");
  viewport.addEventListener("click", onViewportClick);
  viewport.addEventListener("contextmenu", onViewportContextMenu);
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

  document.querySelectorAll("#pin-tag-options [data-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextTag = button.dataset.tag;
      if (!isDirectionalPinTag(nextTag)) {
        state.pendingDirection = null;
      }
      setPinFormTag(nextTag);
      const editPanelHint = document.getElementById("edit-panel-hint");
      if ((state.panelMode === "add" || state.panelMode === "edit") && editPanelHint) {
        editPanelHint.textContent = getPlacementHint();
      }
      updatePlacementUi();
      updateDraftMarker();
    });
  });

  initRequiresCheckboxes();
  initPinMediaForm();
  initModalMediaNav();
  initDraftPinDrag();
}
