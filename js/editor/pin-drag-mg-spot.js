import { state } from "../state.js";
import { canModifyPin } from "../helpers/permissions.js";
import { applyLabelPosition, highlightPin, updatePinElementPosition } from "../helpers/proximity.js";
import { enforceMgHandleSeparation, mgHandlesCollapsed } from "../helpers/mg-placement.js";
import { pushPinMoveSnapshot } from "./undo-redo.js";
import { refreshMgSpotGroup } from "../ui/mg-spot-arrows.js";
import { showEditorToast } from "../ui/editor-toast.js";
import { persistPinPosition } from "../helpers/pin-persist.js";
import { getPinLabel, screenToMapPx, mapPxToPercent } from "./pin-drag-coords.js";
import { runPointerDragSession } from "./pin-drag.js";

function getImageSize() {
  const image = document.getElementById("map-image");
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  };
}

export function beginMgHandleDrag(anchor, clientX, clientY) {
  const { width: imgW, height: imgH } = getImageSize();
  const anchorPx = {
    x: (anchor.x / 100) * imgW,
    y: (anchor.y / 100) * imgH,
  };
  const pointerPx = screenToMapPx(clientX, clientY);

  const dragState = {
    grabOffsetX: anchorPx.x - pointerPx.x,
    grabOffsetY: anchorPx.y - pointerPx.y,
    imgW,
    imgH,
  };
  dragState.lastX = anchor.x;
  dragState.lastY = anchor.y;
  dragState.hadSeparationIssue = false;
  return dragState;
}

export function beginMgSpotDrag(pinRef, handle, clientX, clientY) {
  const anchorX = handle === "head" ? pinRef.dirX : pinRef.x;
  const anchorY = handle === "head" ? pinRef.dirY : pinRef.y;
  return beginMgHandleDrag({ x: anchorX, y: anchorY }, clientX, clientY);
}

export function moveMgSpotDrag(clientX, clientY, dragState, fixedAnchor = null) {
  const pointerPx = screenToMapPx(clientX, clientY);
  const px = Math.min(dragState.imgW, Math.max(0, pointerPx.x + dragState.grabOffsetX));
  const py = Math.min(dragState.imgH, Math.max(0, pointerPx.y + dragState.grabOffsetY));
  let coords = mapPxToPercent(px, py, dragState.imgW, dragState.imgH);

  if (fixedAnchor) {
    const enforced = enforceMgHandleSeparation(fixedAnchor.x, fixedAnchor.y, coords.x, coords.y);
    coords = { x: enforced.x, y: enforced.y };
    dragState.hadSeparationIssue = dragState.hadSeparationIssue || enforced.wasCollapsed;
  }

  dragState.lastX = coords.x;
  dragState.lastY = coords.y;
  return coords;
}

export function applyMgHeadLabel(pinRef, label, dirX, dirY) {
  if (!label) return;
  applyLabelPosition({ ...pinRef, dirX, dirY }, label, { x: dirX, y: dirY, unit: "percent" });
}

export function syncDraftMgCollapseHint(barX, barY, headX, headY) {
  state.mgCollapseHint = mgHandlesCollapsed(barX, barY, headX, headY);
}

function canDragPinInEditor(pin) {
  return state.panelMode === "browse" && canModifyPin(pin) && !state.pinSaveInFlight;
}

export function attachMgSpotDrag(group, pin) {
  const headEl = group.querySelector(".mg-spot-head");
  const baseEl = group.querySelector(".mg-spot-base");

  headEl?.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (!canDragPinInEditor(pin)) return;
    startMgSpotDrag(event, pin, group, "head");
  });

  baseEl?.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (!canDragPinInEditor(pin)) return;
    startMgSpotDrag(event, pin, group, "bar");
  });
}

export function startMgSpotDrag(event, pin, group, handle) {
  if (state.pinSaveInFlight) return;

  const pinRef = state.pins.find((item) => item.id === pin.id);
  if (!pinRef) return;

  const label = getPinLabel(pin.id);
  const handleEl = event.currentTarget;

  runPointerDragSession(event, {
    captureElement: handleEl,
    onDragStart({ startClient }) {
      pushPinMoveSnapshot(pinRef);
      state.pinDragSession = { pinId: pinRef.id, type: "mg-spot", handle };
      group.classList.add("map-mg-spot--dragging");
      group.parentNode?.appendChild(group);
      return beginMgSpotDrag(pinRef, handle, startClient.x, startClient.y);
    },
    onDragMove(clientX, clientY, dragState) {
      const coords = moveMgSpotDrag(
        clientX,
        clientY,
        dragState,
        handle === "head" ? { x: pinRef.x, y: pinRef.y } : { x: pinRef.dirX, y: pinRef.dirY }
      );

      if (handle === "head") {
        refreshMgSpotGroup(group, { x: pinRef.x, y: pinRef.y, dirX: coords.x, dirY: coords.y });
        applyMgHeadLabel(pinRef, label, coords.x, coords.y);
      } else {
        refreshMgSpotGroup(group, { x: coords.x, y: coords.y, dirX: pinRef.dirX, dirY: pinRef.dirY });
      }
    },
    onTap() {
      if (state.panelMode === "browse") {
        highlightPin(pinRef.id);
      }
    },
    onTeardown() {
      group.classList.remove("map-mg-spot--dragging");
    },
    async onDragEnd(dragState) {
      if (handle === "head") {
        pinRef.dirX = dragState.lastX;
        pinRef.dirY = dragState.lastY;
      } else {
        pinRef.x = dragState.lastX;
        pinRef.y = dragState.lastY;
      }

      refreshMgSpotGroup(group, pinRef);
      updatePinElementPosition(pinRef.id);

      if (dragState.hadSeparationIssue) {
        showEditorToast("Head and bar were too close — position adjusted");
      }

      persistPinPosition(pinRef);
    },
  });
}
