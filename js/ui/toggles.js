import { state, loadToggleState, saveToggleState } from "../state.js";
import { restoreMapBgFadeSettings } from "./map-bg-fade.js";

export function applyToggleStateToUi() {
  const saved = loadToggleState();
  const gridEl = document.getElementById("toggle-grid");
  const spEl = document.getElementById("toggle-strongpoints");
  const previewEl = document.getElementById("toggle-preview");
  const colorEl = document.getElementById("toggle-color");
  if (gridEl) gridEl.checked = saved.grid ?? false;
  if (spEl) spEl.checked = saved.strongpoints ?? true;
  if (previewEl) previewEl.checked = saved.preview ?? true;
  if (colorEl) colorEl.checked = saved.bgColor ?? true;
  state.previewEnabled = previewEl ? previewEl.checked : saved.preview ?? true;
  restoreMapBgFadeSettings({
    enabled: saved.bgColor ?? true,
    hue: saved.bgHue ?? null,
    random: saved.bgRandom ?? saved.bgHue == null,
  });
}

export function applyToggleStateToOverlays() {
  if (!state.mapOverlays) return;
  const saved = loadToggleState();
  state.mapOverlays.setToggle("grid", saved.grid ?? false);
  state.mapOverlays.setToggle("strongpoints", saved.strongpoints ?? true);
}

export function persistToggles() {
  const gridEl = document.getElementById("toggle-grid");
  const spEl = document.getElementById("toggle-strongpoints");
  const previewEl = document.getElementById("toggle-preview");
  const colorEl = document.getElementById("toggle-color");
  const saved = loadToggleState();
  saveToggleState({
    grid: gridEl ? gridEl.checked : false,
    strongpoints: spEl ? spEl.checked : true,
    preview: previewEl ? previewEl.checked : true,
    bgColor: colorEl ? colorEl.checked : true,
    bgHue: saved.bgHue ?? null,
    bgRandom: saved.bgRandom ?? true,
  });
}

export function persistBgHue(hue) {
  const saved = loadToggleState();
  saveToggleState({ ...saved, bgHue: hue, bgRandom: false });
}

export function persistBgRandom(random, hue = null) {
  const saved = loadToggleState();
  saveToggleState({
    ...saved,
    bgRandom: random,
    bgHue: random ? null : hue ?? saved.bgHue ?? null,
  });
}
