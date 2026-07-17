import { state } from "../state.js";
import { canModifyPin } from "../helpers/permissions.js";
import { applyLabelPosition, highlightPin } from "../helpers/proximity.js";
import { persistPinPosition } from "../helpers/pin-persist.js";
import { roundCoord } from "../helpers/position-code.js";
import { pushPinMoveSnapshot, pushPositionSnapshot } from "./undo-redo.js";
import { isPlacementComplete, updatePlacementUi } from "./placement-mode.js";
import { updateDraftMarker } from "./draft-renderer.js";
import { refreshMgSpotGroup } from "../ui/mg-spot-arrows.js";
import { getViewport, getImage, getPinLabel, getImageSize, screenToMapPx, mapPxToPercent } from "./pin-drag-coords.js";
import {
  attachMgSpotDrag,
  beginMgHandleDrag,
  moveMgSpotDrag,
  syncDraftMgCollapseHint,
} from "./pin-drag-mg-spot.js";

export { attachMgSpotDrag };

const DRAG_THRESHOLD_PX = 4;

function clearDragStyles(element, label) {
  element.classList.remove("map-pin--dragging");
  element.style.left = "";
  element.style.top = "";

  if (label) {
    label.classList.remove("map-pin__label--dragging");
    label.style.left = "";
    label.style.top = "";
  }
}

function hasExceededDragThreshold(dx, dy) {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;
}

function createGrabDragState(anchor, clientX, clientY) {
  const { width: imgW, height: imgH } = getImageSize();
  const anchorPx = {
    x: (anchor.x / 100) * imgW,
    y: (anchor.y / 100) * imgH,
  };
  const pointerPx = screenToMapPx(clientX, clientY);

  return {
    grabOffsetX: anchorPx.x - pointerPx.x,
    grabOffsetY: anchorPx.y - pointerPx.y,
    imgW,
    imgH,
    anchorPx,
  };
}

export function runPointerDragSession(event, { captureElement, onDragStart, onDragMove, onDragEnd, onTap, onTeardown }) {
  event.preventDefault();
  event.stopPropagation();

  const viewport = getViewport();
  const startClient = { x: event.clientX, y: event.clientY };
  let dragging = false;
  let dragState = null;
  const activePointerId = event.pointerId;

  const onPointerMove = (moveEvent) => {
    if (moveEvent.pointerId !== activePointerId) return;

    const dx = moveEvent.clientX - startClient.x;
    const dy = moveEvent.clientY - startClient.y;
    if (!dragging && !hasExceededDragThreshold(dx, dy)) return;

    if (!dragging) {
      dragging = true;
      dragState = onDragStart({ startClient, viewport, activePointerId });
      captureElement.setPointerCapture(activePointerId);
      viewport?.classList.add("is-pin-dragging");
    }

    onDragMove(moveEvent.clientX, moveEvent.clientY, dragState);
  };

  const finishDrag = async (upEvent) => {
    if (upEvent.pointerId !== activePointerId) return;

    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", finishDrag);
    window.removeEventListener("pointercancel", finishDrag);

    state.pinDragSession = null;
    viewport?.classList.remove("is-pin-dragging");
    onTeardown?.();

    try {
      captureElement.releasePointerCapture(activePointerId);
    } catch {
      /* pointer may already be released */
    }

    if (!dragging) {
      onTap?.();
      return;
    }

    await onDragEnd(dragState);
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", finishDrag);
  window.addEventListener("pointercancel", finishDrag);
}

function beginMapDrag(element, label, anchor, clientX, clientY) {
  element.classList.add("map-pin--dragging");
  if (label) {
    label.classList.add("map-pin__label--dragging");
  }

  const dragState = createGrabDragState(anchor, clientX, clientY);
  dragState.lastPx = dragState.anchorPx.x;
  dragState.lastPy = dragState.anchorPx.y;
  delete dragState.anchorPx;
  return dragState;
}

function moveMapDrag(element, pin, label, clientX, clientY, dragState) {
  const pointerPx = screenToMapPx(clientX, clientY);
  const px = Math.min(dragState.imgW, Math.max(0, pointerPx.x + dragState.grabOffsetX));
  const py = Math.min(dragState.imgH, Math.max(0, pointerPx.y + dragState.grabOffsetY));

  dragState.lastPx = px;
  dragState.lastPy = py;

  element.style.left = `${px}px`;
  element.style.top = `${py}px`;

  if (label && pin) {
    applyLabelPosition(pin, label, { x: px, y: py, unit: "px" });
  }
}

function endMapDrag(element, label, dragState) {
  const coords = mapPxToPercent(dragState.lastPx, dragState.lastPy, dragState.imgW, dragState.imgH);
  clearDragStyles(element, label);
  return coords;
}

export function isPinDragActive() {
  return Boolean(state.pinDragSession);
}

export function canDragDraftInEditor() {
  return (
    state.editMode &&
    (state.panelMode === "add" || state.panelMode === "edit") &&
    isPlacementComplete() &&
    !state.pinSaveInFlight
  );
}

export function canDragPinInEditor(pin) {
  return state.panelMode === "browse" && canModifyPin(pin) && !state.pinSaveInFlight;
}

function finishDraftPlacement(coordsUpdater) {
  coordsUpdater();
  updatePlacementUi();
  updateDraftMarker();
}

const DRAFT_DRAG_BOUND = "data-draft-drag-bound";

export function attachDraftClimbDrag(draftPin) {
  if (!draftPin || draftPin.hasAttribute(DRAFT_DRAG_BOUND)) return;
  draftPin.setAttribute(DRAFT_DRAG_BOUND, "true");

  draftPin.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (!canDragDraftInEditor()) return;
    startDraftClimbDrag(event, draftPin);
  });
}

export function attachDraftMgSpotDrag(draftArrow) {
  if (!draftArrow || draftArrow.hasAttribute(DRAFT_DRAG_BOUND)) return;
  draftArrow.setAttribute(DRAFT_DRAG_BOUND, "true");

  draftArrow.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (!canDragDraftInEditor()) return;

    const head = event.target.closest(".mg-spot-head");
    const base = event.target.closest(".mg-spot-base");
    if (!head && !base) return;

    const group = draftArrow.querySelector(".map-mg-spot--draft.is-placement-complete");
    if (!group) return;

    startDraftMgSpotDrag(event, group, head ? "head" : "bar", head || base);
  });
}

export function initDraftPinDrag() {
  attachDraftClimbDrag(document.getElementById("map-draft-pin"));
  attachDraftMgSpotDrag(document.getElementById("map-draft-arrow"));
}

export function attachClimbPinDrag(button, pin) {
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (!canDragPinInEditor(pin)) return;
    startClimbPinDrag(event, pin, button);
  });
}

function startClimbPinDrag(event, pin, element) {
  if (state.pinSaveInFlight) return;

  const pinRef = state.pins.find((item) => item.id === pin.id);
  if (!pinRef) return;

  const label = getPinLabel(pin.id);
  let beforeDrag = null;

  runPointerDragSession(event, {
    captureElement: element,
    onDragStart({ startClient }) {
      beforeDrag = { x: pinRef.x, y: pinRef.y, dirX: pinRef.dirX, dirY: pinRef.dirY };
      pushPinMoveSnapshot(pinRef);
      state.pinDragSession = { pinId: pinRef.id, type: "climb" };
      return beginMapDrag(element, label, pinRef, startClient.x, startClient.y);
    },
    onDragMove(clientX, clientY, dragState) {
      moveMapDrag(element, pinRef, label, clientX, clientY, dragState);
    },
    onTap() {
      if (state.panelMode === "browse") {
        highlightPin(pinRef.id);
      }
    },
    async onDragEnd(dragState) {
      const coords = endMapDrag(element, label, dragState);
      pinRef.x = coords.x;
      pinRef.y = coords.y;
      persistPinPosition(pinRef);
    },
  });
}

function startDraftClimbDrag(event, element) {
  if (state.pinSaveInFlight) return;

  const coords = state.pendingCoords;
  if (!coords) return;

  runPointerDragSession(event, {
    captureElement: element,
    onDragStart({ startClient }) {
      pushPositionSnapshot();
      state.pinDragSession = { type: "draft-climb" };
      return beginMapDrag(element, null, coords, startClient.x, startClient.y);
    },
    onDragMove(clientX, clientY, dragState) {
      moveMapDrag(element, { tag: "climb", x: coords.x, y: coords.y }, null, clientX, clientY, dragState);
    },
    onDragEnd(dragState) {
      const nextCoords = endMapDrag(element, null, dragState);
      finishDraftPlacement(() => {
        state.pendingCoords = {
          x: roundCoord(nextCoords.x),
          y: roundCoord(nextCoords.y),
        };
      });
    },
  });
}

function beginDraftMgSpotDrag(handle, clientX, clientY) {
  const anchor = handle === "head" ? state.pendingDirection : state.pendingCoords;
  return beginMgHandleDrag(anchor, clientX, clientY);
}

function startDraftMgSpotDrag(event, group, handle, handleEl) {
  if (state.pinSaveInFlight) return;
  if (!state.pendingCoords || !state.pendingDirection) return;

  runPointerDragSession(event, {
    captureElement: handleEl,
    onDragStart({ startClient }) {
      pushPositionSnapshot();
      state.pinDragSession = { type: "draft-mg-spot", handle };
      group.classList.add("map-mg-spot--dragging");
      group.parentNode?.appendChild(group);
      return beginDraftMgSpotDrag(handle, startClient.x, startClient.y);
    },
    onDragMove(clientX, clientY, dragState) {
      const coords = moveMgSpotDrag(
        clientX,
        clientY,
        dragState,
        handle === "head"
          ? { x: state.pendingCoords.x, y: state.pendingCoords.y }
          : { x: state.pendingDirection.x, y: state.pendingDirection.y }
      );

      if (handle === "head") {
        refreshMgSpotGroup(group, {
          x: state.pendingCoords.x,
          y: state.pendingCoords.y,
          dirX: coords.x,
          dirY: coords.y,
        });
        syncDraftMgCollapseHint(state.pendingCoords.x, state.pendingCoords.y, coords.x, coords.y);
      } else {
        refreshMgSpotGroup(group, {
          x: coords.x,
          y: coords.y,
          dirX: state.pendingDirection.x,
          dirY: state.pendingDirection.y,
        });
        syncDraftMgCollapseHint(coords.x, coords.y, state.pendingDirection.x, state.pendingDirection.y);
      }
    },
    onTeardown() {
      group.classList.remove("map-mg-spot--dragging");
    },
    onDragEnd(dragState) {
      finishDraftPlacement(() => {
        if (handle === "head") {
          state.pendingDirection = {
            x: roundCoord(dragState.lastX),
            y: roundCoord(dragState.lastY),
          };
        } else {
          state.pendingCoords = {
            x: roundCoord(dragState.lastX),
            y: roundCoord(dragState.lastY),
          };
        }
        syncDraftMgCollapseHint(
          state.pendingCoords.x,
          state.pendingCoords.y,
          state.pendingDirection.x,
          state.pendingDirection.y
        );
      });
    },
  });
}
