import { state } from "../state.js";
import { deletePin as apiDeletePin } from "../api/pins.js";
import { pushPinDeleteSnapshot } from "../editor/undo-redo.js";
import { isMgSpotPlacement } from "../editor/placement-mode.js";

function getPinContextMenu() {
  return document.getElementById("pin-context-menu");
}

function getEditMenuButton() {
  return getPinContextMenu()?.querySelector('[data-action="edit"]');
}

/** @type {null | "draft" | "edit-pin"} */
let deleteOnlyMenuKind = null;

export function showPinContextMenu(clientX, clientY) {
  const menu = getPinContextMenu();
  if (!menu || !state.contextMenuPin || state.panelMode === null) return;
  deleteOnlyMenuKind = null;
  getEditMenuButton()?.classList.remove("hidden");
  menu.style.left = clientX + "px";
  menu.style.top = clientY + "px";
  menu.classList.remove("hidden");
}

function showDeleteOnlyContextMenu(clientX, clientY, kind) {
  const menu = getPinContextMenu();
  if (!menu) return;
  state.contextMenuPin = null;
  deleteOnlyMenuKind = kind;
  getEditMenuButton()?.classList.add("hidden");
  menu.style.left = clientX + "px";
  menu.style.top = clientY + "px";
  menu.classList.remove("hidden");
}

export function handleEditorPlacementContextMenu(event) {
  let kind = null;

  if (state.panelMode === "add") {
    if (!state.pendingCoords && !state.pendingDirection) return false;
    kind = "draft";
  } else if (state.panelMode === "edit") {
    if (!state.editingPinId || !state.pendingCoords) return false;
    if (isMgSpotPlacement() && !state.pendingDirection) return false;
    kind = "edit-pin";
  } else {
    return false;
  }

  if (event.target.closest(".map-pin:not(.map-pin--draft), .map-mg-spot:not(.map-mg-spot--draft)")) {
    return false;
  }

  event.preventDefault();
  showDeleteOnlyContextMenu(event.clientX, event.clientY, kind);
  return true;
}

export function hidePinContextMenu() {
  const menu = getPinContextMenu();
  if (!menu) return;
  menu.classList.add("hidden");
  state.contextMenuPin = null;
  deleteOnlyMenuKind = null;
  getEditMenuButton()?.classList.remove("hidden");
}

export function onPinContextMenuAction(event, {
  canModifyFn,
  reloadPinsForMapFn,
  startEditPinFn,
  deleteEditPinFn,
  deleteAddPinPlacementFn,
}) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const menuKind = deleteOnlyMenuKind;
  const pin = state.contextMenuPin;
  hidePinContextMenu();

  if (menuKind === "draft" || (menuKind === "edit-pin" && state.addPinSession)) {
    if (action === "delete") {
      void deleteAddPinPlacementFn?.();
    }
    return;
  }

  if (menuKind === "edit-pin") {
    if (action === "delete") {
      void deleteEditPinFn?.();
    }
    return;
  }

  if (!pin) return;
  if (action === "edit") {
    if (canModifyFn(pin)) startEditPinFn(pin);
  } else if (action === "delete") {
    if (!canModifyFn(pin)) return;
    pushPinDeleteSnapshot(pin);
    (async function () {
      try {
        await apiDeletePin(state.currentMapId, pin.id);
        await reloadPinsForMapFn(state.currentMapId);
      } catch (error) {
        state.positionHistory.pop();
        console.error(error);
        alert(error.message || "Could not delete trick");
      }
    })();
  }
}

export function onContextMenuKeyDown(event) {
  if (event.key === "Escape") {
    hidePinContextMenu();
  }
}
