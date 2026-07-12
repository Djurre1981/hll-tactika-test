import { state } from "../state.js";
import { canEnterEditorMode, canModifyPin } from "../helpers/permissions.js";
import { DEFAULT_PIN_TAG } from "../pin-tags.js";
import { hasPinDirection, renderDraftMgSpot } from "./mg-spot-arrows.js";
import { hidePreviewImmediately } from "./pin-preview.js";
import { closeModal } from "./pin-modal.js";
import { applyEditorFactionToUi } from "./filter-bar.js";
import { highlightPin, focusPin } from "../helpers/proximity.js";
import { setPinFormTag, updatePlacementUi, syncViewportFormClasses, isPlacementComplete } from "../editor/placement-mode.js";
import { hidePlacementCrosshair, updateDraftMarker } from "../editor/draft-renderer.js";
import { updateFactionRequires, setRequiresData, resetRequires, resetEditUndoSnapshot, flushAndSavePin } from "../editor/form-handler.js";
import { resetPinMediaForm, setPinMediaFormItems, isMediaUploadInProgress } from "../editor/media-form.js";
import { getPinMediaItems } from "../helpers/pin-media.js";
import { renderPins } from "./pin-marker.js";
import { renderPinList } from "./sidebar.js";
import { hidePinContextMenu } from "./pin-context-menu.js";
import { showEditorToast } from "./editor-toast.js";

function getEditPanel() {
  return document.getElementById("edit-panel");
}

function getSidebarDefault() {
  return document.getElementById("sidebar-default");
}

function updateSidebarSectionsVisibility() {
  const inEditor = isInEditorMode();
  const formOpen = isFormOpen();
  document.getElementById("sidebar-map-section")?.classList.toggle("hidden", inEditor);
  document.getElementById("sidebar-edit-tools")?.classList.toggle("hidden", !inEditor || formOpen);
  getSidebarDefault()?.classList.toggle("is-editor-mode", inEditor);
}

function getEditPanelTitle() {
  return document.getElementById("edit-panel-title");
}

function getEditPanelHint() {
  return document.getElementById("edit-panel-hint");
}

function getPinForm() {
  return document.getElementById("pin-form");
}

function getPinCoords() {
  return document.getElementById("pin-coords");
}

function getEditToolButtons() {
  return document.querySelectorAll("#sidebar-edit-tools .glass-pill-btn");
}

function getModeSwitch() {
  return document.getElementById("mode-switch");
}

function getPinTitle() {
  return document.getElementById("pin-title");
}

function getPinDescription() {
  return document.getElementById("pin-description");
}

function getDraftPin() {
  return document.getElementById("map-draft-pin");
}

function getDraftArrow() {
  return document.getElementById("map-draft-arrow");
}

function getZoomLabel() {
  return document.getElementById("zoom-label");
}

function isInEditorMode() {
  return state.panelMode !== null;
}

function isFormOpen() {
  return state.panelMode === "add" || state.panelMode === "edit";
}

export function updateZoomLabel() {
  const zoomLabel = getZoomLabel();
  zoomLabel.textContent = `${state.mapViewer.getZoomPercent()}%`;
}

export function toggleEditMode() {
  if (!canEnterEditorMode()) {
    return;
  }

  if (isInEditorMode()) {
    exitEditorMode();
    return;
  }

  enterEditorMode();
}

function syncViewportModeClasses() {
  state.mapViewer?.setEditorMode(isInEditorMode());
}

function resetPinFormUi() {
  getPinForm().reset();
  getPinCoords().textContent = "No position selected";
  setPinFormTag(DEFAULT_PIN_TAG);
  resetPinMediaForm();
}

function transitionEditorMode({
  panelMode,
  resetPositionHistory = false,
  hidePreview = false,
  resetMapEditMode = false,
  resetPinForm = false,
  headerButtonAnimate = false,
  headerButtonsBeforeHighlight = false,
}) {
  state.panelMode = panelMode;
  state.editingPinId = null;
  if (panelMode === null) {
    hidePinContextMenu();
  }
  state.pendingCoords = null;
  state.pendingDirection = null;
  state.mgCollapseHint = false;
  state.editMode = false;
  state.pinDragSession = null;
  if (resetPositionHistory) {
    state.positionHistory = [];
    state.redoHistory = [];
  }

  if (hidePreview) {
    hidePreviewImmediately();
  }

  setSidebarDefaultVisible(true);

  if (resetMapEditMode) {
    state.mapViewer?.setEditMode(false);
  }

  getEditPanel().classList.add("hidden");
  hidePlacementCrosshair();

  if (resetPinForm) {
    resetPinFormUi();
  }

  const refreshMapAndList = () => {
    highlightPin(null);
    updateDraftMarker();
    renderPins();
    renderPinList();
    updateSidebarSectionsVisibility();
  };

  if (headerButtonsBeforeHighlight) {
    updateEditorHeaderButtons({ animate: headerButtonAnimate });
    refreshMapAndList();
  } else {
    refreshMapAndList();
    updateEditorHeaderButtons({ animate: headerButtonAnimate });
  }

  syncViewportModeClasses();
  syncViewportFormClasses();
}

export function enterEditorMode() {
  if (!canEnterEditorMode()) {
    return;
  }

  transitionEditorMode({
    panelMode: "browse",
    hidePreview: true,
    headerButtonAnimate: true,
  });
}

export function backToEditorBrowse({ preserveHistory = true } = {}) {
  if (!isInEditorMode()) return;

  state.addPinSession = false;
  transitionEditorMode({
    panelMode: "browse",
    resetPositionHistory: !preserveHistory,
    hidePreview: true,
    resetMapEditMode: true,
    resetPinForm: true,
  });
}

export async function tryBackToEditorBrowse(options = {}) {
  if (isFormOpen()) {
    const canLeaveWithoutTitle = state.panelMode === "add" && !isPlacementComplete();
    if (!canLeaveWithoutTitle) {
      const title = getPinTitle()?.value.trim();
      if (!title) {
        shakeTitleField();
        return false;
      }

      if (isMediaUploadInProgress()) {
        showEditorToast("Wait for the upload to finish", { durationMs: 3000 });
        return false;
      }

      const result = await flushAndSavePin();
      if (!result.ok) {
        if (result.reason === "title") {
          shakeTitleField();
        }
        return false;
      }
    }
  }
  backToEditorBrowse(options);
  return true;
}

function shakeTitleField() {
  const input = getPinTitle();
  if (!input) return;
  input.classList.remove("is-shake");
  void input.offsetWidth;
  input.classList.add("is-shake");
  input.focus();
  input.addEventListener(
    "animationend",
    () => input.classList.remove("is-shake"),
    { once: true }
  );
}

export function exitEditorMode() {
  state.addPinSession = false;
  transitionEditorMode({
    panelMode: null,
    resetPositionHistory: true,
    resetMapEditMode: true,
    resetPinForm: true,
    headerButtonsBeforeHighlight: true,
  });
}

/** @deprecated Use exitEditorMode — kept for map-switch and legacy callers */
export function closeEditPanel() {
  exitEditorMode();
}

export function setSidebarDefaultVisible(visible) {
  const sidebarDefault = getSidebarDefault();
  sidebarDefault?.classList.toggle("hidden", !visible);
}

function resetAddForm() {
  state.editingPinId = null;
  state.pendingCoords = null;
  state.pendingDirection = null;
  state.mgCollapseHint = false;

  hidePlacementCrosshair();
  const draftPin = getDraftPin();
  draftPin?.classList.add("hidden");
  renderDraftMgSpot(getDraftArrow(), null, null);
  getPinForm().reset();
  getPinCoords().textContent = "No position selected";
  state.pendingFaction = state.currentFaction;
  setPinFormTag(DEFAULT_PIN_TAG);
  applyEditorFactionToUi();
  updateFactionRequires(state.pendingFaction);
  resetRequires();
  resetPinMediaForm();
  const editPanelHint = getEditPanelHint();
  if (editPanelHint) editPanelHint.textContent = "";
}

export function openAddPinForm(tag = DEFAULT_PIN_TAG) {
  if (!canEnterEditorMode()) {
    return;
  }

  if (!isInEditorMode()) {
    enterEditorMode();
  }

  resetEditUndoSnapshot();
  state.addPinSession = true;
  state.panelMode = "add";
  state.editingPinId = null;
  state.editMode = true;

  hidePreviewImmediately();
  setSidebarDefaultVisible(false);
  state.mapViewer?.setEditMode(true);
  getEditPanel().classList.remove("hidden");
  resetAddForm();
  setPinFormTag(tag);
  getEditPanelTitle().textContent = "EDIT POSITION";
  updateEditorHeaderButtons();
  highlightPin(null);
  updateDraftMarker();
  renderPins();
  syncViewportModeClasses();
  syncViewportFormClasses();
}

/** @deprecated Use openAddPinForm */
export function startAddPin() {
  openAddPinForm();
}

export function startEditPin(pin, { focus = false } = {}) {
  if (!pin || !canModifyPin(pin)) return;

  if (!isInEditorMode()) {
    enterEditorMode();
  }

  hidePreviewImmediately();
  closeModal();
  resetEditUndoSnapshot();
  state.addPinSession = false;
  state.panelMode = "edit";
  state.editingPinId = pin.id;
  state.pendingCoords = { x: pin.x, y: pin.y };
  state.pendingDirection =
    pin.tag === "mg-spot" && hasPinDirection(pin)
      ? { x: pin.dirX, y: pin.dirY }
      : null;
  state.editMode = true;

  setSidebarDefaultVisible(false);
  state.mapViewer?.setEditMode(true);
  getEditPanel().classList.remove("hidden");
  getPinTitle().value = pin.title;
  getPinDescription().value = pin.description || "";
  setPinMediaFormItems(getPinMediaItems(pin), pin.thumbnail);
  state.pendingFaction = pin.faction || "neutral";
  setPinFormTag(pin.tag);
  applyEditorFactionToUi();
  updateFactionRequires(state.pendingFaction);
  setRequiresData(pin.requires);
  getEditPanelTitle().textContent = "EDIT POSITION";
  const editPanelHint = getEditPanelHint();
  if (editPanelHint) editPanelHint.textContent = "";
  updateEditorHeaderButtons();
  highlightPin(pin.id);
  hidePlacementCrosshair();
  updatePlacementUi();
  updateDraftMarker();
  renderPins();
  if (focus) {
    focusPin(pin, { zoomPercent: 100 });
  }
  syncViewportModeClasses();
  syncViewportFormClasses();
}

export function updateEditorHeaderButtons({ animate = false } = {}) {
  const inEditor = isInEditorMode();
  const formOpen = isFormOpen();
  const modeSwitch = getModeSwitch();
  const editToolButtons = getEditToolButtons();

  modeSwitch?.classList.toggle("is-editor", inEditor);
  modeSwitch?.querySelector('[data-mode="viewer"]')?.setAttribute("aria-selected", String(!inEditor));
  modeSwitch?.querySelector('[data-mode="editor"]')?.setAttribute("aria-selected", String(inEditor));

  document.getElementById("sidebar-edit-tools")?.classList.toggle("hidden", !inEditor || formOpen);

  if (inEditor && animate) {
    editToolButtons.forEach((button) => {
      button.classList.remove("is-animating");
      void button.offsetWidth;
      button.classList.add("is-animating");
      button.addEventListener(
        "animationend",
        () => button.classList.remove("is-animating"),
        { once: true }
      );
    });
  }
}
