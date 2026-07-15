import { state } from "../state.js";

const MAX_EDIT_HISTORY = 30;

function isEditHistoryEnabled() {
  return state.appMode === "editor" && state.panelMode !== null
    || state.positionHistory.length > 0
    || state.redoHistory.length > 0;
}

function isTypingTarget(target) {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target?.isContentEditable;
}

function trimHistoryStack(stack) {
  if (stack.length > MAX_EDIT_HISTORY) {
    stack.shift();
  }
}

function copyPinMoveSnapshot(pin) {
  return {
    mode: "pin-move",
    pinId: pin.id,
    x: pin.x,
    y: pin.y,
    dirX: pin.dirX,
    dirY: pin.dirY,
  };
}

function copyPlacementSnapshot() {
  return {
    mode: "placement",
    coords: state.pendingCoords ? { ...state.pendingCoords } : null,
    direction: state.pendingDirection ? { ...state.pendingDirection } : null,
  };
}

function copyPinRestoreSnapshot(pin, mapId = state.currentMapId) {
  return {
    mode: "pin-restore",
    mapId,
    pin: pinToCreatePayload(pin),
  };
}

function copyPinUpdateSnapshot(pin, mapId = state.currentMapId) {
  return {
    mode: "pin-update",
    mapId,
    pinId: pin.id,
    pin: pinToCreatePayload(pin),
  };
}

function copyPinRemoveSnapshot(pinId, mapId = state.currentMapId) {
  return {
    mode: "pin-remove",
    mapId,
    pinId,
  };
}

function pinToCreatePayload(pin) {
  const payload = {
    id: pin.id,
    title: pin.title,
    description: pin.description || "",
    tag: pin.tag,
    x: pin.x,
    y: pin.y,
    videoUrl: pin.videoUrl || "",
    faction: pin.faction || "neutral",
    requires: pin.requires || {},
  };

  if (pin.thumbnail) {
    payload.thumbnail = pin.thumbnail;
  }
  if (Array.isArray(pin.mediaItems) && pin.mediaItems.length > 0) {
    payload.mediaItems = pin.mediaItems.map((item) => ({ ...item }));
  }
  if (pin.dirX != null && pin.dirY != null) {
    payload.dirX = pin.dirX;
    payload.dirY = pin.dirY;
  }

  return payload;
}

function pushSnapshot(snapshot) {
  state.redoHistory = [];
  state.positionHistory.push(snapshot);
  trimHistoryStack(state.positionHistory);
}

function clearEditHistory() {
  state.positionHistory = [];
  state.redoHistory = [];
}

export {
  isEditHistoryEnabled,
  isTypingTarget,
  trimHistoryStack,
  copyPinMoveSnapshot,
  copyPlacementSnapshot,
  copyPinRestoreSnapshot,
  copyPinUpdateSnapshot,
  copyPinRemoveSnapshot,
  pinToCreatePayload,
  pushSnapshot,
  clearEditHistory,
  MAX_EDIT_HISTORY,
};
