import { cachePinDetail, resolvePinDetail } from "../helpers/pin-detail-cache.js";
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
import {
  updateFactionRequires,
  setRequiresData,
  resetRequires,
  resetEditUndoSnapshot,
  markEditUndoBaselinePushed,
  clearEditFormBaseline,
  captureEditFormBaselineFromForm,
  isEditFormBaselineReady,
} from "../editor/form-handler.js";
import { resetPinMediaForm, setPinMediaFormItems, isMediaUploadInProgress } from "../editor/media-form.js";
import { getPinMediaItems } from "../helpers/pin-media.js";
import { renderPins } from "./pin-marker.js";
import { renderPinList } from "./sidebar.js";
import { showEditorToast } from "./editor-toast.js";
import { pushPinUpdateSnapshot } from "../editor/undo-redo.js";
import {
  getEditPanel,
  getEditPanelHint,
  getPinForm,
  getPinCoords,
  getEditPanelTitle,
  getPinTitle,
  getPinDescription,
  getDraftPin,
  getDraftArrow,
  enterEditorMode,
  exitEditorMode,
  isInEditorMode,
  isFormOpen,
  setSidebarDefaultVisible,
  updateEditorHeaderButtons,
  syncViewportModeClasses,
  flushOpenPinForm,
} from "./pin-editor.js";

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

function openAddPinForm(tag = DEFAULT_PIN_TAG) {
  if (!canEnterEditorMode()) {
    return;
  }

  if (!isInEditorMode()) {
    enterEditorMode();
  }

  resetEditUndoSnapshot();
  clearEditFormBaseline();
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

async function startEditPin(marker, { focus = false } = {}) {
  if (!marker || !canModifyPin(marker)) return;

  if (state.panelMode === "edit" && state.editingPinId === marker.id) return;

  if (isFormOpen()) {
    if (!(await flushOpenPinForm())) return;
  }

  if (!isInEditorMode()) {
    enterEditorMode();
  }

  hidePreviewImmediately();
  closeModal();
  resetEditUndoSnapshot();
  clearEditFormBaseline();
  state.addPinSession = false;
  state.panelMode = "edit";
  state.editingPinId = marker.id;
  state.pendingCoords = { x: marker.x, y: marker.y };
  state.pendingDirection =
    marker.tag === "mg-spot" && hasPinDirection(marker)
      ? { x: marker.dirX, y: marker.dirY }
      : null;
  state.editMode = true;

  setSidebarDefaultVisible(false);
  state.mapViewer?.setEditMode(true);
  getEditPanel().classList.remove("hidden");
  getPinTitle().value = marker.title;
  getPinDescription().value = "";
  setPinMediaFormItems([], marker.thumbnail);
  state.pendingFaction = marker.faction || "neutral";
  setPinFormTag(marker.tag);
  applyEditorFactionToUi();
  updateFactionRequires(state.pendingFaction);
  setRequiresData(marker.requires);
  getEditPanelTitle().textContent = "EDIT POSITION";
  const editPanelHint = getEditPanelHint();
  if (editPanelHint) editPanelHint.textContent = "Loading pin details…";
  updateEditorHeaderButtons();
  highlightPin(marker.id);
  hidePlacementCrosshair();
  updatePlacementUi();
  updateDraftMarker();
  renderPins();
  if (focus) {
    focusPin(marker, { zoomPercent: 100 });
  }
  syncViewportModeClasses();
  syncViewportFormClasses();

  try {
    const pin = await resolvePinDetail(state.currentMapId, marker);
    if (state.editingPinId !== marker.id) return;
    if (!canModifyPin(pin)) {
      void exitEditorMode();
      return;
    }
    getPinDescription().value = pin.description || "";
    setPinMediaFormItems(getPinMediaItems(pin), pin.thumbnail);
    setRequiresData(pin.requires);
    state.pendingFaction = pin.faction || "neutral";
    applyEditorFactionToUi();
    updateFactionRequires(state.pendingFaction);
    cachePinDetail(state.currentMapId, pin.id, pin);
    pushPinUpdateSnapshot(pin);
    markEditUndoBaselinePushed();
    captureEditFormBaselineFromForm();
    if (editPanelHint) editPanelHint.textContent = "";
  } catch (error) {
    console.error(error);
    if (state.editingPinId !== marker.id) return;
    if (editPanelHint) editPanelHint.textContent = "Could not load pin details.";
  }
}

export {
  openAddPinForm,
  startEditPin,
};
