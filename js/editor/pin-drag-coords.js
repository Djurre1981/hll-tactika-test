import { state } from "../state.js";

export function getViewport() {
  return document.getElementById("map-viewport");
}

export function getImage() {
  return document.getElementById("map-image");
}

export function getPinLabel(pinId) {
  return document.querySelector(`.map-pin__label[data-id="${pinId}"]`);
}

export function clampMapCoord(value) {
  return Math.min(100, Math.max(0, value));
}

export function getImageSize() {
  const image = getImage();
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  };
}

export function screenToMapPx(clientX, clientY) {
  const { width, height } = getImageSize();
  const percent = state.mapViewer.screenToMapPercent(clientX, clientY);
  return {
    x: (percent.x / 100) * width,
    y: (percent.y / 100) * height,
  };
}

export function mapPxToPercent(px, py, imgW, imgH) {
  return {
    x: clampMapCoord((px / imgW) * 100),
    y: clampMapCoord((py / imgH) * 100),
  };
}


