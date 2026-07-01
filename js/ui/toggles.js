import { state, loadToggleState, saveToggleState } from "../state.js";

export function applyToggleStateToUi() {
  const saved = loadToggleState();
  const gridEl = document.getElementById("toggle-grid");
  const spEl = document.getElementById("toggle-strongpoints");
  const previewEl = document.getElementById("toggle-preview");
  if (gridEl) gridEl.checked = saved.grid ?? false;
  if (spEl) spEl.checked = saved.strongpoints ?? true;
  if (previewEl) previewEl.checked = saved.preview ?? true;
  state.previewEnabled = previewEl ? previewEl.checked : saved.preview ?? true;
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
  saveToggleState({
    grid: gridEl ? gridEl.checked : false,
    strongpoints: spEl ? spEl.checked : true,
    preview: previewEl ? previewEl.checked : true,
  });
}
