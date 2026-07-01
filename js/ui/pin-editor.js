import { state } from "../state.js";
import { canModifyPin } from "../helpers/permissions.js";
import { DEFAULT_PIN_TAG } from "../pin-tags.js";
import { hasPinDirection, renderDraftMgSpot } from "./mg-spot-arrows.js";
import { hidePreviewImmediately } from "./pin-preview.js";
import { closeModal } from "./pin-modal.js";
import { applyEditorFactionToUi } from "./filter-bar.js";
import { highlightPin, focusPin } from "../helpers/proximity.js";
import { setPinFormTag, isPlacementComplete, updatePlacementUi } from "../editor/placement-mode.js";
import { hidePlacementCrosshair, updateDraftMarker } from "../editor/draft-renderer.js";
import { updateFactionRequires, setRequiresData, resetRequires } from "../editor/form-handler.js";
import { renderPins } from "./pin-marker.js";

function getEditPanel() {
  return document.getElementById("edit-panel");
}

function getSidebarDefault() {
  return document.getElementById("sidebar-default");
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

function getBtnSavePin() {
  return document.getElementById("btn-save-pin");
}

function getBtnDeletePin() {
  return document.getElementById("btn-delete-pin");
}

function getBtnToggleEdit() {
  return document.getElementById("btn-toggle-edit");
}

function getPinTitle() {
  return document.getElementById("pin-title");
}

function getPinDescription() {
  return document.getElementById("pin-description");
}

function getPinVideo() {
  return document.getElementById("pin-video");
}

function getPinThumbnail() {
  return document.getElementById("pin-thumbnail");
}

function getDraftPin() {
  return document.getElementById("map-draft-pin");
}

function getDraftArrow() {
  return document.getElementById("map-draft-arrow");
}

function getCrosshair() {
  return document.getElementById("map-crosshair");
}

function getZoomLabel() {
  return document.getElementById("zoom-label");
}

export function updateZoomLabel() {
  const zoomLabel = getZoomLabel();
  zoomLabel.textContent = `${state.mapViewer.getZoomPercent()}%`;
}

export function toggleEditMode() {
  if (state.panelMode !== null) {
    closeEditPanel();
    return;
  }

  startAddPin();
}

export function setSidebarDefaultVisible(visible) {
  const sidebarDefault = getSidebarDefault();
  sidebarDefault?.classList.toggle("hidden", !visible);
}

export function startAddPin() {
  state.positionHistory = [];
  state.panelMode = "add";
  state.editingPinId = null;
  state.pendingCoords = null;
  state.pendingDirection = null;
  state.editMode = true;

  hidePreviewImmediately();
  setSidebarDefaultVisible(false);
  state.mapViewer?.setEditMode(true);
  getEditPanel().classList.remove("hidden");
  hidePlacementCrosshair();
  const draftPin = getDraftPin();
  draftPin?.classList.add("hidden");
  renderDraftMgSpot(getDraftArrow(), null, null);
  getPinForm().reset();
  getPinCoords().textContent = "No position selected";
  getBtnSavePin().disabled = true;
  getBtnSavePin().textContent = "Save pin";
  const btnDeletePin = getBtnDeletePin();
  btnDeletePin?.classList.add("hidden");
  state.pendingFaction = state.currentFaction;
  setPinFormTag(DEFAULT_PIN_TAG);
  applyEditorFactionToUi();
  updateFactionRequires(state.pendingFaction);
  resetRequires();
  getEditPanelTitle().textContent = "EDITOR MODE";
  const editPanelHint = getEditPanelHint();
  if (editPanelHint) editPanelHint.textContent = "";
  updateEditToggleButton();
  highlightPin(null);
  updateDraftMarker();
  renderPins();
}

export function startEditPin(pin, { focus = true } = {}) {
  if (!pin || !canModifyPin(pin)) return;

  state.positionHistory = [];
  hidePreviewImmediately();
  closeModal();
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
  getPinVideo().value = pin.videoUrl || "";
  getPinThumbnail().value = pin.thumbnail || "";
  state.pendingFaction = pin.faction || "neutral";
  setPinFormTag(pin.tag);
  applyEditorFactionToUi();
  updateFactionRequires(state.pendingFaction);
  setRequiresData(pin.requires);
  getBtnSavePin().disabled = !isPlacementComplete();
  getBtnSavePin().textContent = "Save changes";
  const btnDeletePin = getBtnDeletePin();
  btnDeletePin?.classList.remove("hidden");
  getEditPanelTitle().textContent = "EDITOR MODE";
  const editPanelHint = getEditPanelHint();
  if (editPanelHint) editPanelHint.textContent = "";
  updateEditToggleButton();
  highlightPin(pin.id);
  hidePlacementCrosshair();
  updatePlacementUi();
  updateDraftMarker();
  renderPins();
  if (focus) {
    focusPin(pin);
  }
}

export function closeEditPanel() {
  state.panelMode = null;
  state.editingPinId = null;
  state.pendingCoords = null;
  state.pendingDirection = null;
  state.editMode = false;

  setSidebarDefaultVisible(true);
  state.mapViewer?.setEditMode(false);
  getEditPanel().classList.add("hidden");
  hidePlacementCrosshair();
  getPinForm().reset();
  getPinCoords().textContent = "No position selected";
  getBtnSavePin().disabled = true;
  getBtnSavePin().textContent = "Save pin";
  const btnDeletePin = getBtnDeletePin();
  btnDeletePin?.classList.add("hidden");
  setPinFormTag(DEFAULT_PIN_TAG);
  updateEditToggleButton();
  highlightPin(null);
  updateDraftMarker();
  renderPins();
}

export function updateEditToggleButton() {
  const isOpen = state.panelMode !== null;
  const btnToggleEdit = getBtnToggleEdit();
  if (isOpen) {
    btnToggleEdit.textContent = "Cancel Edit";
    btnToggleEdit.style.background = "transparent";
    btnToggleEdit.style.borderColor = "var(--border)";
    btnToggleEdit.style.color = "#e8ebe6";
  } else {
    btnToggleEdit.textContent = "Editor Mode";
    btnToggleEdit.style.background = "";
    btnToggleEdit.style.borderColor = "";
    btnToggleEdit.style.color = "";
  }
  btnToggleEdit.classList.toggle("btn--primary", !isOpen);
  btnToggleEdit.classList.toggle("btn--ghost", isOpen);
}
