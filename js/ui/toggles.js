import { state } from "../state.js";
import { getViewerPreferences, scheduleSaveViewerPreferences } from "../viewer-preferences.js";
import { getMapBgHue, isMapBgHueRandom, restoreMapBgFadeSettings } from "./map-bg-fade.js";

export function setMapLabelsVisible(show) {
  state.mapLabelsVisible = show;
  const btn = document.getElementById("btn-toggle-map-labels");
  const viewport = document.getElementById("map-viewport");
  btn?.classList.toggle("is-active", show);
  btn?.setAttribute("aria-pressed", String(show));
  if (btn) btn.title = show ? "Hide map labels" : "Show map labels";
  viewport?.classList.toggle("is-labels-hidden", !show);
}

export function applyMapLabelsToUi() {
  const prefs = getViewerPreferences();
  setMapLabelsVisible(prefs.mapLabels);
}

export function applyToggleStateToUi() {
  const prefs = getViewerPreferences();
  const gridEl = document.getElementById("toggle-grid");
  const spEl = document.getElementById("toggle-strongpoints");
  const previewEl = document.getElementById("toggle-preview");
  const colorEl = document.getElementById("toggle-color");
  if (gridEl) gridEl.checked = prefs.grid;
  if (spEl) spEl.checked = prefs.strongpoints;
  if (previewEl) previewEl.checked = prefs.preview;
  if (colorEl) colorEl.checked = prefs.bgColor;
  state.previewEnabled = previewEl ? previewEl.checked : prefs.preview;
  applyMapLabelsToUi();
  restoreMapBgFadeSettings({
    enabled: prefs.bgColor,
    hue: prefs.bgHue,
    random: prefs.bgRandom,
  });
}

export function applyToggleStateToOverlays() {
  if (!state.mapOverlays) return;
  const prefs = getViewerPreferences();
  state.mapOverlays.setToggle("grid", prefs.grid);
  state.mapOverlays.setToggle("strongpoints", prefs.strongpoints);
}

function readTogglePrefsFromUi() {
  const gridEl = document.getElementById("toggle-grid");
  const spEl = document.getElementById("toggle-strongpoints");
  const previewEl = document.getElementById("toggle-preview");
  const colorEl = document.getElementById("toggle-color");
  const prefs = getViewerPreferences();
  return {
    grid: gridEl ? gridEl.checked : prefs.grid,
    strongpoints: spEl ? spEl.checked : prefs.strongpoints,
    preview: previewEl ? previewEl.checked : prefs.preview,
    bgColor: colorEl ? colorEl.checked : prefs.bgColor,
    mapLabels: state.mapLabelsVisible,
    bgHue: isMapBgHueRandom() ? null : getMapBgHue(),
    bgRandom: isMapBgHueRandom(),
  };
}

export function persistToggles() {
  scheduleSaveViewerPreferences(readTogglePrefsFromUi());
}

export function persistBgHue(hue) {
  scheduleSaveViewerPreferences({ bgHue: hue, bgRandom: false });
}

export function persistBgRandom(random, hue = null) {
  scheduleSaveViewerPreferences({
    bgRandom: random,
    bgHue: random ? null : hue ?? getViewerPreferences().bgHue,
  });
}
