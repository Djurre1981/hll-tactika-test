import { state, loadToggleState, saveToggleState } from "../state.js";

export function applyToggleStateToUi() {
  const saved = loadToggleState();
  const gridEl = document.getElementById("toggle-grid");
  const spEl = document.getElementById("toggle-strongpoints");
  if (gridEl) gridEl.checked = saved.grid ?? false;
  if (spEl) spEl.checked = saved.strongpoints ?? true;
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
  saveToggleState({
    grid: gridEl ? gridEl.checked : false,
    strongpoints: spEl ? spEl.checked : true,
  });
}
