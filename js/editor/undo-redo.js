import { state } from "../state.js";
import { createPin, deletePin } from "../api/pins.js";
import { normalizePin } from "../ui/filter-bar.js";
import { updatePlacementUi } from "./placement-mode.js";
import { hidePlacementCrosshair, updateDraftMarker } from "./draft-renderer.js";
import { updatePinElementPosition } from "../helpers/proximity.js";
import { persistPinPosition, markPinDirty } from "../helpers/pin-persist.js";
import { refreshMgSpotGroup } from "../ui/mg-spot-arrows.js";
import { renderPins } from "../ui/pin-marker.js";
import { showEditorToast } from "../ui/editor-toast.js";
import { renderPinList } from "../ui/sidebar.js";
import {
  copyPinMoveSnapshot,
  copyPlacementSnapshot,
  copyPinRestoreSnapshot,
  copyPinUpdateSnapshot,
  copyPinRemoveSnapshot,
  pushSnapshot,
  trimHistoryStack,
  isEditHistoryEnabled,
  isTypingTarget,
  clearEditHistory,
} from "./undo-redo-snapshots.js";

function applyPinMoveSnapshot(snapshot) {
  const pin = state.pins.find((item) => item.id === snapshot.pinId);
  if (!pin) return false;

  pin.x = snapshot.x;
  pin.y = snapshot.y;
  if (snapshot.dirX != null && snapshot.dirY != null) {
    pin.dirX = snapshot.dirX;
    pin.dirY = snapshot.dirY;
  } else {
    delete pin.dirX;
    delete pin.dirY;
  }

  updatePinElementPosition(pin.id);
  if (pin.tag === "mg-spot" && pin.dirX != null && pin.dirY != null) {
    const group = document.querySelector(`.map-mg-spot[data-id="${pin.id}"]`);
    if (group) {
      refreshMgSpotGroup(group, pin);
    }
  }
  persistPinPosition(pin);
  return true;
}

function applyPlacementSnapshot(snapshot) {
  state.pendingCoords = snapshot.coords;
  state.pendingDirection = snapshot.direction;
  updatePlacementUi();
  hidePlacementCrosshair();
  updateDraftMarker();
  return true;
}

function addPinToState(mapId, pin) {
  const normalized = normalizePin(pin);
  if (!state.pinCatalog[mapId]) {
    state.pinCatalog[mapId] = [];
  }
  state.pinCatalog[mapId].push(normalized);
  if (mapId === state.currentMapId) {
    state.pins.push(normalized);
    renderPins();
    renderPinList();
  }
}

function removePinFromState(mapId, pinId) {
  if (state.pinCatalog[mapId]) {
    state.pinCatalog[mapId] = state.pinCatalog[mapId].filter((item) => item.id !== pinId);
  }
  if (mapId === state.currentMapId) {
    state.pins = state.pins.filter((item) => item.id !== pinId);
    if (state.editingPinId === pinId) {
      state.editingPinId = null;
    }
    if (state.highlightedPinId === pinId) {
      state.highlightedPinId = null;
    }
    if (state.modalPin?.id === pinId) {
      state.modalPin = null;
    }
    renderPins();
    renderPinList();
  }
}

function replacePinInState(mapId, pinId, pin) {
  const normalized = normalizePin(pin);
  if (state.pinCatalog[mapId]) {
    const index = state.pinCatalog[mapId].findIndex((item) => item.id === pinId);
    if (index >= 0) {
      state.pinCatalog[mapId][index] = normalized;
    }
  }
  if (mapId === state.currentMapId) {
    const index = state.pins.findIndex((item) => item.id === pinId);
    if (index >= 0) {
      state.pins[index] = normalized;
    }
    renderPins();
    renderPinList();
  }
}

async function applyPinUpdateSnapshot(snapshot) {
  replacePinInState(snapshot.mapId, snapshot.pinId, snapshot.pin);
  markPinDirty(snapshot.pinId);
  if (state.editingPinId === snapshot.pinId && state.panelMode === "edit") {
    const pin = snapshot.pin;
    const titleEl = document.getElementById("pin-title");
    const descEl = document.getElementById("pin-description");
    if (titleEl) titleEl.value = pin.title || "";
    if (descEl) descEl.value = pin.description || "";
  }
  renderPins();
  renderPinList();
  return true;
}

async function applyPinRestoreSnapshot(snapshot) {
  try {
    const restored = await createPin(snapshot.mapId, snapshot.pin);
    addPinToState(snapshot.mapId, restored);
    return true;
  } catch (error) {
    console.error(error);
    showEditorToast(error.message || "Could not restore trick");
    return false;
  }
}

async function applyPinRemoveSnapshot(snapshot) {
  try {
    await deletePin(snapshot.mapId, snapshot.pinId);
    removePinFromState(snapshot.mapId, snapshot.pinId);
    return true;
  } catch (error) {
    console.error(error);
    showEditorToast(error.message || "Could not delete trick");
    return false;
  }
}

export function initUndoRedoKeyboard() {
  window.addEventListener("keydown", (event) => {
    if (!event.ctrlKey || event.altKey || event.metaKey || isTypingTarget(event.target)) {
      return;
    }

    const isUndo = event.key === "z" || event.key === "Z" || event.code === "KeyZ";
    const isRedo = event.key === "y" || event.key === "Y" || event.code === "KeyY";

    if (!isUndo && !isRedo) return;
    if (!isEditHistoryEnabled()) return;

    event.preventDefault();
    event.stopPropagation();

    if (isUndo) {
      popPositionSnapshot();
    } else {
      popRedoSnapshot();
    }
  }, { capture: true });
}

export function pushPositionSnapshot() {
  pushSnapshot(copyPlacementSnapshot());
}

export function pushPinMoveSnapshot(pin) {
  pushSnapshot(copyPinMoveSnapshot(pin));
}

export function pushPinDeleteSnapshot(pin) {
  pushSnapshot(copyPinRestoreSnapshot(pin));
}

export function pushPinUpdateSnapshot(pin) {
  pushSnapshot(copyPinUpdateSnapshot(pin));
}

export function pushPinCreateSnapshot(pinId, mapId = state.currentMapId) {
  pushSnapshot(copyPinRemoveSnapshot(pinId, mapId));
}

export function popPositionSnapshot() {
  if (state.positionHistory.length === 0) return false;

  const snap = state.positionHistory.pop();

  if (snap.mode === "pin-move") {
    const pin = state.pins.find((item) => item.id === snap.pinId);
    if (pin) {
      state.redoHistory.push(copyPinMoveSnapshot(pin));
      trimHistoryStack(state.redoHistory);
    }
    return applyPinMoveSnapshot(snap);
  }

  if (snap.mode === "pin-restore") {
    state.redoHistory.push(copyPinRemoveSnapshot(snap.pin.id, snap.mapId));
    trimHistoryStack(state.redoHistory);
    void applyPinRestoreSnapshot(snap);
    return true;
  }

  if (snap.mode === "pin-update") {
    const pin = state.pins.find((item) => item.id === snap.pinId);
    if (pin) {
      state.redoHistory.push(copyPinUpdateSnapshot(pin));
      trimHistoryStack(state.redoHistory);
    }
    void applyPinUpdateSnapshot(snap);
    return true;
  }

  if (snap.mode === "pin-remove") {
    const pin = state.pins.find((item) => item.id === snap.pinId)
      || state.pinCatalog[snap.mapId]?.find((item) => item.id === snap.pinId);
    if (pin) {
      state.redoHistory.push(copyPinRestoreSnapshot(pin, snap.mapId));
      trimHistoryStack(state.redoHistory);
    }
    void applyPinRemoveSnapshot(snap);
    return true;
  }

  state.redoHistory.push(copyPlacementSnapshot());
  trimHistoryStack(state.redoHistory);
  return applyPlacementSnapshot(snap);
}

export function popRedoSnapshot() {
  if (state.redoHistory.length === 0) return false;

  const snap = state.redoHistory.pop();

  if (snap.mode === "pin-move") {
    const pin = state.pins.find((item) => item.id === snap.pinId);
    if (pin) {
      state.positionHistory.push(copyPinMoveSnapshot(pin));
      trimHistoryStack(state.positionHistory);
    }
    return applyPinMoveSnapshot(snap);
  }

  if (snap.mode === "pin-remove") {
    const pin = state.pins.find((item) => item.id === snap.pinId)
      || state.pinCatalog[snap.mapId]?.find((item) => item.id === snap.pinId);
    if (pin) {
      state.positionHistory.push(copyPinRestoreSnapshot(pin, snap.mapId));
      trimHistoryStack(state.positionHistory);
    }
    void applyPinRemoveSnapshot(snap);
    return true;
  }

  if (snap.mode === "pin-update") {
    const pin = state.pins.find((item) => item.id === snap.pinId);
    if (pin) {
      state.positionHistory.push(copyPinUpdateSnapshot(pin));
      trimHistoryStack(state.positionHistory);
    }
    void applyPinUpdateSnapshot(snap);
    return true;
  }

  if (snap.mode === "pin-restore") {
    state.positionHistory.push(copyPinRemoveSnapshot(snap.pin.id, snap.mapId));
    trimHistoryStack(state.positionHistory);
    void applyPinRestoreSnapshot(snap);
    return true;
  }

  state.positionHistory.push(copyPlacementSnapshot());
  trimHistoryStack(state.positionHistory);
  return applyPlacementSnapshot(snap);
}

export {
  clearEditHistory,
};
