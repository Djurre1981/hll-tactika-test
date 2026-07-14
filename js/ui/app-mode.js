import { state } from "../state.js";
import { enterEditorMode, exitEditorMode, updateEditorHeaderButtons } from "./pin-editor.js";
import { hidePreviewImmediately } from "./pin-preview.js";
import { renderPins } from "./pin-marker.js";
import { renderPinList } from "./sidebar.js";
import { closeModal } from "./pin-modal.js";
import { confirmStratsUnsavedAction, discardStratsUnsavedChanges } from "../helpers/strats-unsaved.js";
import { exitStratEditorSession } from "./strats.js";

function getLayout() {
  return document.querySelector(".layout");
}

function getModeSwitch() {
  return document.getElementById("mode-switch");
}

export function syncAppModeChrome() {
  const mode = state.appMode;
  const layout = getLayout();
  const modeSwitch = getModeSwitch();

  layout?.classList.toggle("is-strats-mode", mode === "strats");
  layout?.classList.toggle("is-guide-mode", mode !== "strats");

  modeSwitch?.classList.toggle("is-editor", mode === "editor");
  modeSwitch?.classList.toggle("is-strats", mode === "strats");

  modeSwitch?.querySelector('[data-mode="viewer"]')?.setAttribute("aria-selected", String(mode === "viewer"));
  modeSwitch?.querySelector('[data-mode="editor"]')?.setAttribute("aria-selected", String(mode === "editor"));
  modeSwitch?.querySelector('[data-mode="strats"]')?.setAttribute("aria-selected", String(mode === "strats"));

  document.getElementById("sidebar-default")?.classList.toggle("hidden", mode === "strats");
  document.getElementById("strats-sidebar")?.classList.toggle("hidden", mode !== "strats");
  document.getElementById("strats-slides-shell")?.classList.toggle("hidden", mode !== "strats");
  document.getElementById("map-toolbar-shell")?.classList.toggle("hidden", mode === "strats");

  const showDrawLayer = mode === "strats" && Boolean(state.activeStrat);
  document.getElementById("strats-draw-layer")?.classList.toggle("hidden", !showDrawLayer);
  document.getElementById("strats-draw-preview")?.classList.toggle("hidden", !showDrawLayer);
  document.getElementById("strats-handles-layer")?.classList.toggle("hidden", !showDrawLayer);

  const viewport = document.getElementById("map-viewport");
  viewport?.classList.toggle("is-strats-mode", mode === "strats");
  if (mode === "strats") {
    const tool = state.stratsToolSettings.activeTool;
    viewport?.classList.toggle("is-strats-drawing", tool !== "select");
  } else {
    viewport?.classList.remove("is-strats-drawing");
  }

  if (mode === "strats") {
    document.getElementById("edit-panel")?.classList.add("hidden");
  } else if (mode === "editor") {
    updateEditorHeaderButtons();
  }

  state.mapViewer?.setEditorMode(mode === "editor" && state.panelMode !== null);
}

export async function setAppMode(mode) {
  if (state.appMode === mode) {
    return true;
  }

  const leavingStrats = state.appMode === "strats" && mode !== "strats";
  if (leavingStrats) {
    if (!confirmStratsUnsavedAction("Discard unsaved strat changes and leave Strats mode?")) {
      return false;
    }
    discardStratsUnsavedChanges();
  }

  if (mode !== "editor" && state.panelMode !== null) {
    const exited = await exitEditorMode();
    if (exited === false) {
      return false;
    }
  }

  if (mode === "strats") {
    hidePreviewImmediately();
    closeModal();
  }

  state.appMode = mode;

  if (leavingStrats) {
    void exitStratEditorSession();
  }

  if (mode === "editor" && state.panelMode === null) {
    enterEditorMode();
  }

  syncAppModeChrome();
  renderPins();
  renderPinList();
  state.mapViewer?.followSidebarLayout();
  return true;
}
