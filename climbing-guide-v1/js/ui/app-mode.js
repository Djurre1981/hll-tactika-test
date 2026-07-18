import { state } from "../state.js";
import { enterEditorMode, exitEditorMode, updateEditorHeaderButtons } from "./pin-editor.js";
import { renderPins } from "./pin-marker.js";
import { renderPinList } from "./sidebar.js";

function getLayout() {
  return document.querySelector(".layout");
}

function getModeSwitch() {
  return document.getElementById("mode-switch");
}

export function syncToolChrome(tool = state.toolRoute) {
  const modeSwitch = getModeSwitch();
  const stratsTab = modeSwitch?.querySelector('[data-mode="strats"]');
  if (tool) state.toolRoute = tool;

  if (state.toolRoute === "climbing-guide") {
    stratsTab?.classList.add("hidden");
  }
}

export function syncAppModeChrome() {
  const mode = state.appMode;
  const layout = getLayout();
  const modeSwitch = getModeSwitch();

  layout?.classList.toggle("is-guide-mode", true);
  layout?.classList.remove("is-strats-mode");

  modeSwitch?.classList.toggle("is-editor", mode === "editor");
  modeSwitch?.classList.remove("is-strats");
  modeSwitch?.classList.toggle("is-guide-tool", true);

  modeSwitch?.querySelector('[data-mode="viewer"]')?.setAttribute("aria-selected", String(mode === "viewer"));
  modeSwitch?.querySelector('[data-mode="editor"]')?.setAttribute("aria-selected", String(mode === "editor"));
  modeSwitch?.querySelector('[data-mode="strats"]')?.setAttribute("aria-selected", "false");

  syncToolChrome(state.toolRoute);

  document.getElementById("sidebar-default")?.classList.remove("hidden");
  document.getElementById("strats-sidebar")?.classList.add("hidden");
  document.getElementById("strats-slides-shell")?.classList.add("hidden");
  document.getElementById("map-toolbar-shell")?.classList.remove("hidden");
  document.getElementById("strats-draw-layer")?.classList.add("hidden");
  document.getElementById("strats-draw-preview")?.classList.add("hidden");
  document.getElementById("strats-handles-layer")?.classList.add("hidden");

  const viewport = document.getElementById("map-viewport");
  viewport?.classList.remove("is-strats-mode", "is-strats-drawing");

  if (mode === "editor") {
    updateEditorHeaderButtons();
  }

  state.mapViewer?.setEditorMode(mode === "editor" && state.panelMode !== null);
}

export async function setAppMode(mode) {
  if (state.appMode === mode) {
    return true;
  }

  if (mode === "strats") {
    return false;
  }

  if (mode !== "editor" && state.panelMode !== null) {
    const exited = await exitEditorMode();
    if (exited === false) {
      return false;
    }
  }

  state.appMode = mode;

  if (mode === "editor" && state.panelMode === null) {
    enterEditorMode();
  }

  syncAppModeChrome();
  renderPins();
  renderPinList();
  state.mapViewer?.followSidebarLayout();
  return true;
}
