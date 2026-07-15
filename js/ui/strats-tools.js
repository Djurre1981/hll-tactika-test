import { state } from "../state.js";
import { STRAT_ICON_OPTIONS } from "../helpers/strat-defaults.js";
import {
  convertSelectedObjectType,
  copySelectedObject,
  deleteSelectedStratObject,
  duplicateSelectedObject,
  getSelectedObject,
  pasteClipboardObject,
  reorderSelectedObject,
} from "../strats/strat-drawing.js";
import {
  syncStrokeOptions,
  syncShapeOptions,
  syncTextOptions,
  syncIconOptions,
  populateColorSwatches,
  syncColorUi,
  syncClipboardButtons,
  syncSelectionPanel,
  loadSettingsFromObject,
  commitSettingsChange,
} from "./strats-tools-options.js";

const OPTION_PANELS = {
  select: "select",
  pen: "stroke",
  line: "stroke",
  arrow: "stroke",
  rect: "shape",
  ellipse: "shape",
  text: "text",
  eraser: "select",
  icons: "icons",
  ping: "select",
};

const OBJECT_TYPE_PANEL = {
  pen: "stroke",
  line: "stroke",
  arrow: "stroke",
  rect: "shape",
  ellipse: "shape",
  text: "text",
  icon: "icons",
  ping: "select",
};

let selectedObject = null;
let onSettingsApplied = null;

function getToolButtons() {
  return document.querySelectorAll("#strats-tools-panel .strats-tools__btn[data-tool]");
}

function getOptionPanels() {
  return document.querySelectorAll("#strats-tool-options [data-tool-panel]");
}

function isEditingSelection() {
  return state.stratsToolSettings.activeTool === "select" && Boolean(selectedObject);
}

function getEffectivePanelKey() {
  const tool = state.stratsToolSettings.activeTool;
  if (tool === "select" && selectedObject) {
    return OBJECT_TYPE_PANEL[selectedObject.type] || "select";
  }
  return OPTION_PANELS[tool] || "select";
}

function setActiveToolButton(tool) {
  getToolButtons().forEach((button) => {
    const isActive = button.dataset.tool === tool;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function syncOptionPanels() {
  const panelKey = getEffectivePanelKey();
  getOptionPanels().forEach((panel) => {
    const isSelect = panel.dataset.toolPanel === "select";
    const isActivePanel = panel.dataset.toolPanel === panelKey;
    panel.classList.toggle("hidden", !isSelect && !isActivePanel);
  });
  syncSelectionPanel(selectedObject);
}

export function syncStratsToolsUi() {
  const settings = state.stratsToolSettings;
  setActiveToolButton(settings.activeTool);
  syncOptionPanels();
  syncColorUi();
  syncStrokeOptions();
  syncShapeOptions();
  syncTextOptions();
  syncIconOptions();
  syncClipboardButtons();
}

export function handleStratsSelectionChange(object) {
  selectedObject = object;
  if (object) {
    loadSettingsFromObject(object);
  }
  syncStratsToolsUi();
}

export function setStratsTool(tool) {
  state.stratsToolSettings.activeTool = tool;
  if (tool === "arrow" && state.stratsToolSettings.endType === "none") {
    state.stratsToolSettings.endType = "end";
  }
  syncStratsToolsUi();

  const viewport = document.getElementById("map-viewport");
  if (state.appMode === "strats") {
    viewport?.classList.toggle("is-strats-drawing", tool !== "select");
  }
}

function populateIconGrid() {
  const grid = document.getElementById("strats-icon-grid");
  if (!grid || grid.childElementCount > 0) {
    return;
  }

  for (const option of STRAT_ICON_OPTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "strats-tools__icon-btn";
    button.dataset.iconId = option.id;
    button.title = option.id;
    button.setAttribute("aria-label", option.id);
    button.innerHTML = `<i class="fa-solid ${option.icon}" aria-hidden="true"></i>`;
    grid.appendChild(button);
  }
}

function bindSegmentButtons(selector, key, { numeric = false, datasetProp } = {}) {
  document.querySelectorAll(selector).forEach((button) => {
    button.addEventListener("click", () => {
      const prop = datasetProp || key;
      let value = button.dataset[prop];
      if (numeric) {
        value = Number(value);
      }
      state.stratsToolSettings[key] = value;
      syncStratsToolsUi();
      commitSettingsChange(selectedObject, onSettingsApplied);
    });
  });
}

export function initStratsTools({ onSettingsChange } = {}) {
  onSettingsApplied = onSettingsChange;
  populateColorSwatches();
  populateIconGrid();

  getToolButtons().forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      setStratsTool(button.dataset.tool);
    });
  });

  document.getElementById("strats-color-swatches")?.addEventListener("click", (event) => {
    const swatch = event.target.closest(".strats-tools__swatch[data-color]");
    if (!swatch) return;
    state.stratsToolSettings.color = swatch.dataset.color;
    syncColorUi();
    commitSettingsChange(selectedObject, onSettingsApplied);
  });

  document.getElementById("strats-color-picker")?.addEventListener("input", (event) => {
    state.stratsToolSettings.color = event.target.value;
    syncColorUi();
    commitSettingsChange(selectedObject, onSettingsApplied);
  });

  document.getElementById("strats-opt-size")?.addEventListener("input", (event) => {
    state.stratsToolSettings.size = Number(event.target.value);
    syncStrokeOptions();
    commitSettingsChange(selectedObject, onSettingsApplied);
  });

  document.getElementById("strats-opt-shape-size")?.addEventListener("input", (event) => {
    state.stratsToolSettings.size = Number(event.target.value);
    syncShapeOptions();
    commitSettingsChange(selectedObject, onSettingsApplied);
  });

  document.getElementById("strats-opt-font-size")?.addEventListener("input", (event) => {
    state.stratsToolSettings.fontSize = Number(event.target.value);
    syncTextOptions();
    commitSettingsChange(selectedObject, onSettingsApplied);
  });

  document.getElementById("strats-opt-filled")?.addEventListener("change", (event) => {
    state.stratsToolSettings.filled = event.target.checked;
    commitSettingsChange(selectedObject, onSettingsApplied);
  });

  document.getElementById("strats-opt-icon-label")?.addEventListener("input", (event) => {
    state.stratsToolSettings.iconLabel = event.target.value;
    commitSettingsChange(selectedObject, onSettingsApplied);
  });

  bindSegmentButtons("[data-line-type]", "lineType", { datasetProp: "lineType" });
  bindSegmentButtons("[data-end-type]", "endType", { datasetProp: "endType" });
  bindSegmentButtons("[data-shape-line-type]", "lineType", { datasetProp: "shapeLineType" });
  bindSegmentButtons("[data-text-style]", "textStyle", { numeric: true, datasetProp: "textStyle" });
  bindSegmentButtons("[data-text-align]", "textAlign", { datasetProp: "textAlign" });

  document.getElementById("strats-icon-grid")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-icon-id]");
    if (!button) return;
    state.stratsToolSettings.iconId = button.dataset.iconId;
    syncIconOptions();
    commitSettingsChange(selectedObject, onSettingsApplied);
  });

  document.getElementById("strats-btn-copy")?.addEventListener("click", () => {
    if (copySelectedObject()) {
      syncClipboardButtons();
    }
  });

  document.getElementById("strats-btn-paste")?.addEventListener("click", () => {
    if (pasteClipboardObject()) {
      selectedObject = getSelectedObject();
      syncStratsToolsUi();
      onSettingsApplied?.();
    }
  });

  document.getElementById("strats-btn-duplicate")?.addEventListener("click", () => {
    if (duplicateSelectedObject()) {
      selectedObject = getSelectedObject();
      syncStratsToolsUi();
      onSettingsApplied?.();
    }
  });

  document.getElementById("strats-btn-send-back")?.addEventListener("click", () => {
    reorderSelectedObject(-1);
    onSettingsApplied?.();
  });

  document.getElementById("strats-btn-bring-forward")?.addEventListener("click", () => {
    reorderSelectedObject(1);
    onSettingsApplied?.();
  });

  document.getElementById("strats-btn-delete-object")?.addEventListener("click", () => {
    deleteSelectedStratObject();
    onSettingsApplied?.();
  });

  document.querySelectorAll("[data-convert-type]").forEach((button) => {
    button.addEventListener("click", () => {
      convertSelectedObjectType(button.dataset.convertType);
      selectedObject = getSelectedObject();
      syncStratsToolsUi();
      onSettingsApplied?.();
    });
  });

  syncStratsToolsUi();
}

export function setStratsToolsEnabled(enabled) {
  getToolButtons().forEach((button) => {
    button.disabled = !enabled;
  });
}
