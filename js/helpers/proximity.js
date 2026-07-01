import { state } from "../state.js";
import { getFilteredPins } from "../ui/filter-bar.js";
import { hasPinDirection } from "../ui/mg-spot-arrows.js";
import { getMgLabelDirection, getOppositeDirection, getNeutralDirection } from "./constants.js";

export const PIN_HOVER_RADIUS_PX = 42;
export const MG_SPOT_HOVER_RADIUS_PX = 42;

function getViewport() {
  return document.getElementById("map-viewport");
}

function getImage() {
  return document.getElementById("map-image");
}

function getPinsLayer() {
  return document.getElementById("map-pins");
}

function getPinList() {
  return document.getElementById("pin-list");
}

export function highlightPin(pinId) {
  const changed = state.highlightedPinId !== pinId;
  state.highlightedPinId = pinId;
  positionPins();

  const pinList = getPinList();
  pinList.querySelectorAll(".pin-list__row").forEach((row) => {
    const id = row.querySelector(".pin-list__item")?.dataset.id;
    row.classList.toggle("is-active", id === pinId);
  });

  pinList.querySelectorAll(".pin-list__item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.id === pinId);
  });

  if (pinId && changed) {
    const item = pinList.querySelector(`.pin-list__item[data-id="${pinId}"]`);
    item?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

export function findClosestPin(clientX, clientY) {
  const visiblePins = getFilteredPins();
  const mapViewer = state.mapViewer;
  if (!mapViewer || visiblePins.length === 0) return null;

  const viewport = getViewport();
  const rect = viewport.getBoundingClientRect();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;

  let closest = null;
  let minDist = Infinity;

  for (const pin of visiblePins) {
    let checkX = pin.x;
    let checkY = pin.y;
    if (pin.tag === "mg-spot" && hasPinDirection(pin)) {
      checkX = pin.dirX;
      checkY = pin.dirY;
    }
    const point = mapViewer.mapPercentToScreen(checkX, checkY);
    const dist = Math.hypot(point.x - mx, point.y - my);
    if (dist < minDist) {
      minDist = dist;
      closest = pin;
    }
  }

  const baseRadius = closest?.tag === "mg-spot" ? MG_SPOT_HOVER_RADIUS_PX : PIN_HOVER_RADIUS_PX;
  const scaledRadius = baseRadius * mapViewer.scale;
  return minDist <= scaledRadius ? closest : null;
}

export function updateProximityHighlight(clientX, clientY) {
  const pin = findClosestPin(clientX, clientY);
  highlightPin(pin?.id ?? null);
}

export function focusPin(pin) {
  const viewport = getViewport();
  const rect = viewport.getBoundingClientRect();
  const image = getImage();
  const imgW = image.naturalWidth;
  const imgH = image.naturalHeight;
  const mapViewer = state.mapViewer;

  let focusX = pin.x;
  let focusY = pin.y;
  if (pin.tag === "mg-spot" && hasPinDirection(pin)) {
    focusX = pin.dirX;
    focusY = pin.dirY;
  }

  mapViewer.scale = Math.min(2.2, mapViewer.clampScale(1.0));
  mapViewer.translateX = rect.width / 2 - (focusX / 100) * imgW * mapViewer.scale;
  mapViewer.translateY = rect.height / 2 - (focusY / 100) * imgH * mapViewer.scale;
  mapViewer.clampTranslation();
  mapViewer.applyTransform();
  highlightPin(pin.id);
}

export function positionPins() {
  const pinsLayer = getPinsLayer();
  const highlightedPinId = state.highlightedPinId;

  pinsLayer.querySelectorAll(".map-pin").forEach((button) => {
    const pin = getFilteredPins().find((item) => item.id === button.dataset.id);
    if (!pin) return;

    button.style.left = `${pin.x}%`;
    button.style.top = `${pin.y}%`;
    button.classList.toggle("is-highlighted", pin.id === highlightedPinId);
  });

  pinsLayer.querySelectorAll(".map-mg-spot").forEach((group) => {
    group.classList.toggle("is-highlighted", group.dataset.id === highlightedPinId);
  });

  const alliesDir = getMgLabelDirection(state.currentMapId);
  const axisDir = getOppositeDirection(alliesDir);
  const neutralDir = getNeutralDirection(alliesDir);
  pinsLayer.querySelectorAll(".map-pin__label").forEach((label) => {
    const pin = getFilteredPins().find((item) => item.id === label.dataset.id);
    if (!pin) return;
    if (pin.tag === "mg-spot" && pin.dirX != null && pin.dirY != null) {
      label.style.left = `${pin.dirX}%`;
      label.style.top = `${pin.dirY}%`;
      let labelDir;
      if (pin.faction === "allies") {
        labelDir = alliesDir;
      } else if (pin.faction === "axis") {
        labelDir = axisDir;
      } else {
        labelDir = neutralDir;
      }
      label.classList.remove("map-pin__label--left", "map-pin__label--right", "map-pin__label--top", "map-pin__label--bottom");
      label.classList.add(`map-pin__label--${labelDir}`);
    } else {
      label.style.left = `${pin.x}%`;
      label.style.top = `${pin.y}%`;
      label.classList.remove("map-pin__label--left", "map-pin__label--right", "map-pin__label--top", "map-pin__label--bottom");
    }
  });
}
