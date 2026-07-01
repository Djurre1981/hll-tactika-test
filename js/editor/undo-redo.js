import { state } from "../state.js";

const MAX_POSITION_HISTORY = 10;

export function initUndoRedoKeyboard() {
  window.addEventListener("keydown", (event) => {
    const isUndo = event.ctrlKey && (event.key === "w" || event.key === "W" || event.code === "KeyW" || event.key === "z" || event.key === "Z" || event.code === "KeyZ");
    if (isUndo) {
      event.preventDefault();
      event.stopPropagation();
      if (state.editMode && popPositionSnapshot()) {
        const coordsEl = document.getElementById("pin-coords");
        if (coordsEl) coordsEl.textContent = "Undo: reverted to previous position";
      }
      return;
    }
    if (event.ctrlKey && (event.key === "y" || event.key === "Y" || event.code === "KeyY")) {
      event.preventDefault();
      event.stopPropagation();
      if (state.editMode && popRedoSnapshot()) {
        const coordsEl = document.getElementById("pin-coords");
        if (coordsEl) coordsEl.textContent = "Redo: reapplied position";
      }
    }
  }, { capture: true });
}

export function pushPositionSnapshot() {
  state.redoHistory = [];
  state.positionHistory.push({
    coords: state.pendingCoords ? { ...state.pendingCoords } : null,
    direction: state.pendingDirection ? { ...state.pendingDirection } : null,
  });
  if (state.positionHistory.length > MAX_POSITION_HISTORY) {
    state.positionHistory.shift();
  }
}

export function popPositionSnapshot() {
  if (state.positionHistory.length === 0) return false;
  state.redoHistory.push({
    coords: state.pendingCoords ? { ...state.pendingCoords } : null,
    direction: state.pendingDirection ? { ...state.pendingDirection } : null,
  });
  if (state.redoHistory.length > MAX_POSITION_HISTORY) {
    state.redoHistory.shift();
  }
  const snap = state.positionHistory.pop();
  state.pendingCoords = snap.coords;
  state.pendingDirection = snap.direction;
  updatePlacementUi();
  hidePlacementCrosshair();
  updateDraftMarker();
  return true;
}

export function popRedoSnapshot() {
  if (state.redoHistory.length === 0) return false;
  state.positionHistory.push({
    coords: state.pendingCoords ? { ...state.pendingCoords } : null,
    direction: state.pendingDirection ? { ...state.pendingDirection } : null,
  });
  if (state.positionHistory.length > MAX_POSITION_HISTORY) {
    state.positionHistory.shift();
  }
  const snap = state.redoHistory.pop();
  state.pendingCoords = snap.coords;
  state.pendingDirection = snap.direction;
  updatePlacementUi();
  hidePlacementCrosshair();
  updateDraftMarker();
  return true;
}

import { updatePlacementUi } from "./placement-mode.js";
import { hidePlacementCrosshair, updateDraftMarker } from "./draft-renderer.js";
