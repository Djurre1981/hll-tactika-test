import { state } from "../state.js";
import { isDirectionalPinTag, DEFAULT_PIN_TAG } from "../pin-tags.js";
import { generatePositionCode, roundCoord } from "../helpers/position-code.js";
import { MG_COLLAPSE_HINT, mgHandlesCollapsed } from "../helpers/mg-placement.js";
import { hidePlacementCrosshair, showPlacementCrosshairAtScreen, updateDraftMarker } from "./draft-renderer.js";
import { pushPositionSnapshot } from "./undo-redo.js";
import { highlightPin } from "../helpers/proximity.js";

export function setPinFormTag(tagId) {
  state.pendingTag = tagId;
}

export function getPinFormTag() {
  return state.pendingTag || DEFAULT_PIN_TAG;
}

export function isMgSpotPlacement() {
  return isDirectionalPinTag(getPinFormTag() || DEFAULT_PIN_TAG);
}

export function isPlacementComplete() {
  if (isMgSpotPlacement()) return Boolean(state.pendingCoords) && Boolean(state.pendingDirection);
  return Boolean(state.pendingCoords);
}

export function canSavePlacement() {
  return isPlacementComplete() && !state.mgCollapseHint;
}

export function syncViewportFormClasses() {
  const viewport = document.getElementById("map-viewport");
  if (!viewport) return;
  const placing = state.panelMode === "add" && !isPlacementComplete();
  viewport.classList.toggle("is-placing-pin", placing);
  viewport.classList.toggle("is-editing-pin", state.panelMode === "edit");

  const coordsEl = document.getElementById("pin-coords");
  const inPinForm = state.panelMode === "add" || state.panelMode === "edit";
  const hasPlacement = Boolean(state.pendingCoords || state.pendingDirection);
  coordsEl?.classList.toggle("is-clickable", inPinForm && hasPlacement);
}

export function getPlacementHint() {
  if (state.panelMode === "edit") return "";
  if (isMgSpotPlacement()) {
    return "1st click: arrowhead. 2nd click: bar + line. Then drag to adjust.";
  }
  return "Click the map to place a pin, then drag to adjust.";
}

export function updatePlacementUi() {
  updatePositionCode();
  const coordsEl = document.getElementById("pin-coords");
  if (!state.pendingCoords) {
    coordsEl.textContent = "No position selected";
    syncViewportFormClasses();
    notifyPinFormChanged();
    return;
  }

  if (isMgSpotPlacement()) {
    if (!state.pendingDirection) {
      coordsEl.textContent = "No position selected";
      syncViewportFormClasses();
      notifyPinFormChanged();
      return;
    }
    if (!state.pendingCoords) {
      coordsEl.textContent = `Arrowhead: ${state.pendingDirection.x}%, ${state.pendingDirection.y}% — click again for the bar`;
      syncViewportFormClasses();
      notifyPinFormChanged();
      return;
    }
    if (state.mgCollapseHint) {
      coordsEl.textContent = MG_COLLAPSE_HINT;
      syncViewportFormClasses();
      notifyPinFormChanged();
      return;
    }
    coordsEl.textContent = `Arrowhead: ${state.pendingDirection.x}%, ${state.pendingDirection.y}% · Bar: ${state.pendingCoords.x}%, ${state.pendingCoords.y}%`;
    syncViewportFormClasses();
    notifyPinFormChanged();
    return;
  }

  coordsEl.textContent = `Position: ${state.pendingCoords.x}%, ${state.pendingCoords.y}%`;
  syncViewportFormClasses();
  notifyPinFormChanged();
}

function notifyPinFormChanged() {
  document.dispatchEvent(new CustomEvent("pin-form-changed"));
}

function updatePositionCode() {
  const pinPositionCode = document.getElementById("pin-position-code");
  if (!pinPositionCode) return;
  const { pendingCoords, pendingDirection } = state;
  if (!pendingCoords && !pendingDirection) {
    pinPositionCode.textContent = "";
  } else if (isMgSpotPlacement() && pendingDirection) {
    const point = pendingCoords || pendingDirection;
    pinPositionCode.textContent = generatePositionCode(point.x, point.y);
  } else if (pendingCoords) {
    pinPositionCode.textContent = generatePositionCode(pendingCoords.x, pendingCoords.y);
  }
}

export { generatePositionCode, roundCoord };

export function onViewportClick(event) {
  if (!state.editMode) return;
  if (state.pinDragSession) return;
  if (state.panelMode === "edit") return;
  if (state.panelMode === "add" && isPlacementComplete()) return;
  if (event.target.closest(".map-pin:not(.map-pin--draft), .map-mg-spot:not(.map-mg-spot--draft)")) {
    return;
  }

  const mapViewer = state.mapViewer;
  const coords = mapViewer.screenToMapPercent(event.clientX, event.clientY);
  if (coords.x < 0 || coords.y < 0 || coords.x > 100 || coords.y > 100) return;

  const point = {
    x: roundCoord(coords.x),
    y: roundCoord(coords.y),
  };

  if (isMgSpotPlacement()) {
    if (state.pendingDirection) {
      pushPositionSnapshot();
      state.pendingCoords = point;
      state.mgCollapseHint = mgHandlesCollapsed(point.x, point.y, state.pendingDirection.x, state.pendingDirection.y);
    } else {
      pushPositionSnapshot();
      state.pendingDirection = point;
    }
  } else {
    pushPositionSnapshot();
    state.pendingCoords = point;
    state.pendingDirection = null;
  }

  updatePlacementUi();
  hidePlacementCrosshair();
  updateDraftMarker();
}

export function clearDraftPlacement() {
  state.pendingDirection = null;
  state.pendingCoords = null;
  state.mgCollapseHint = false;
  updatePlacementUi();
  hidePlacementCrosshair();
  updateDraftMarker();
}

export function cancelMgSpotHeadPlacement() {
  clearDraftPlacement();
}

export function onViewportContextMenu(event) {
  if (state.panelMode !== "add" && state.panelMode !== "edit") {
    return;
  }

  if (
    event.target.closest(".map-pin:not(.map-pin--draft), .map-mg-spot:not(.map-mg-spot--draft)")
  ) {
    return;
  }
}

export function shouldShowPlacementCrosshair() {
  if (!state.editMode) return false;
  if (state.panelMode === "edit") return false;
  if (isMgSpotPlacement()) return state.pendingDirection && !state.pendingCoords;
  return !state.pendingCoords;
}

export function onViewportMouseMove(event) {
  if (shouldShowPlacementCrosshair()) {
    showPlacementCrosshairAtScreen(event.clientX, event.clientY);
    const mapViewer = state.mapViewer;
    const coords = mapViewer.screenToMapPercent(event.clientX, event.clientY);
    if (coords.x >= 0 && coords.y >= 0 && coords.x <= 100 && coords.y <= 100) {
      if (isMgSpotPlacement() && state.pendingDirection && !state.pendingCoords) {
        updateDraftMarker({
          x: roundCoord(coords.x),
          y: roundCoord(coords.y),
        });
      }
    }
    return;
  }

  if (state.panelMode === "browse") {
    return;
  }

}

export function onViewportMouseLeave() {
  if (shouldShowPlacementCrosshair()) {
    hidePlacementCrosshair();
    if (isMgSpotPlacement() && state.pendingDirection && !state.pendingCoords) {
      updateDraftMarker();
    }
    return;
  }

  if (!state.editMode) {
    highlightPin(null);
  }
}
