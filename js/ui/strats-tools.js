import { state } from "../state.js";
import { STRAT_COLOR_PRESETS, STRAT_ICON_OPTIONS } from "../helpers/strat-defaults.js";
import {
  applySettingsToSelectedObject,
  convertSelectedObjectType,
  copySelectedObject,
  deleteSelectedStratObject,
  duplicateSelectedObject,
  getSelectedObject,
  hasStratsClipboard,
  pasteClipboardObject,
  reorderSelectedObject,
} from "../strats/strat-drawing.js";
import { getObjectTypeLabel } from "../strats/strat-selection-handles.js";

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

function normalizeHex(color) {
  return String(color || "").trim().toLowerCase();
}

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

function syncClipboardButtons() {
  const pasteBtn = document.getElementById("strats-btn-paste");
  pasteBtn?.toggleAttribute("disabled", !hasStratsClipboard());
}

function syncSelectionPanel() {
  const info = document.getElementById("strats-selection-info");
  const emptyHint = document.getElementById("strats-select-empty-hint");
  const typeEl = document.getElementById("strats-selection-type");
  const shapeConvert = document.getElementById("strats-shape-convert");
  const lineConvert = document.getElementById("strats-line-convert");
  const showSelection = isEditingSelection();

  info?.classList.toggle("hidden", !showSelection);
  emptyHint?.classList.toggle("hidden", showSelection);

  if (typeEl) {
    typeEl.textContent = showSelection ? getObjectTypeLabel(selectedObject.type) : "";
  }

  shapeConvert?.classList.toggle("hidden", !showSelection || !["rect", "ellipse"].includes(selectedObject?.type));
  lineConvert?.classList.toggle("hidden", !showSelection || !["line", "arrow"].includes(selectedObject?.type));

  document.querySelectorAll("[data-convert-type]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.convertType === selectedObject?.type);
    button.setAttribute("aria-pressed", String(button.dataset.convertType === selectedObject?.type));
  });

  syncClipboardButtons();
}

function syncOptionPanels() {
  const panelKey = getEffectivePanelKey();
  getOptionPanels().forEach((panel) => {
    const isSelect = panel.dataset.toolPanel === "select";
    const isActivePanel = panel.dataset.toolPanel === panelKey;
    panel.classList.toggle("hidden", !isSelect && !isActivePanel);
  });
  syncSelectionPanel();
}

function loadSettingsFromObject(object) {
  const { style, meta, type } = object;
  state.stratsToolSettings.color = style.color;
  state.stratsToolSettings.size = style.size;
  state.stratsToolSettings.lineType = style.lineType;
  state.stratsToolSettings.endType = style.endType;
  state.stratsToolSettings.filled = style.filled;
  state.stratsToolSettings.fontSize = style.fontSize;
  state.stratsToolSettings.textStyle = style.textStyle;
  state.stratsToolSettings.textAlign = style.textAlign;

  if (type === "icon") {
    state.stratsToolSettings.iconId = meta?.iconId || state.stratsToolSettings.iconId;
    state.stratsToolSettings.iconLabel = meta?.iconLabel || "";
  }
}

function commitSettingsChange() {
  if (isEditingSelection()) {
    applySettingsToSelectedObject(state.stratsToolSettings);
    onSettingsApplied?.();
  }
}

function syncColorUi() {
  const settings = state.stratsToolSettings;
  const color = normalizeHex(settings.color);
  const preview = document.getElementById("strats-color-preview");
  const picker = document.getElementById("strats-color-picker");

  if (preview) {
    preview.style.background = settings.color;
  }
  if (picker && picker.value.toLowerCase() !== color) {
    picker.value = settings.color;
  }

  document.querySelectorAll("#strats-color-swatches .strats-tools__swatch[data-color]").forEach((swatch) => {
    const isActive = normalizeHex(swatch.dataset.color) === color;
    swatch.classList.toggle("is-active", isActive);
  });

  const pickBtn = document.querySelector(".strats-tools__color-pick");
  pickBtn?.classList.toggle("is-active", !STRAT_COLOR_PRESETS.some((preset) => normalizeHex(preset) === color));
}

function populateColorSwatches() {
  const container = document.getElementById("strats-color-swatches");
  if (!container || container.childElementCount > 0) {
    return;
  }

  for (const color of STRAT_COLOR_PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "strats-tools__swatch";
    button.dataset.color = color;
    button.style.background = color;
    button.title = color;
    button.setAttribute("aria-label", color);
    container.appendChild(button);
  }
}

function syncStrokeOptions() {
  const settings = state.stratsToolSettings;
  const sizeInput = document.getElementById("strats-opt-size");
  const sizeValue = document.getElementById("strats-opt-size-value");
  if (sizeInput) sizeInput.value = String(settings.size);
  if (sizeValue) sizeValue.textContent = String(settings.size);

  document.querySelectorAll("[data-line-type]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.lineType === settings.lineType);
    button.setAttribute("aria-pressed", String(button.dataset.lineType === settings.lineType));
  });

  document.querySelectorAll("[data-end-type]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.endType === settings.endType);
    button.setAttribute("aria-pressed", String(button.dataset.endType === settings.endType));
  });
}

function syncShapeOptions() {
  const settings = state.stratsToolSettings;
  const sizeInput = document.getElementById("strats-opt-shape-size");
  const sizeValue = document.getElementById("strats-opt-shape-size-value");
  if (sizeInput) sizeInput.value = String(settings.size);
  if (sizeValue) sizeValue.textContent = String(settings.size);

  document.querySelectorAll("[data-shape-line-type]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.shapeLineType === settings.lineType);
    button.setAttribute("aria-pressed", String(button.dataset.shapeLineType === settings.lineType));
  });

  const filledInput = document.getElementById("strats-opt-filled");
  if (filledInput) {
    filledInput.checked = settings.filled;
  }
}

function syncTextOptions() {
  const settings = state.stratsToolSettings;
  const fontSizeInput = document.getElementById("strats-opt-font-size");
  const fontSizeValue = document.getElementById("strats-opt-font-size-value");
  if (fontSizeInput) fontSizeInput.value = String(settings.fontSize);
  if (fontSizeValue) fontSizeValue.textContent = String(settings.fontSize);

  document.querySelectorAll("[data-text-style]").forEach((button) => {
    const active = Number(button.dataset.textStyle) === settings.textStyle;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  document.querySelectorAll("[data-text-align]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.textAlign === settings.textAlign);
    button.setAttribute("aria-pressed", String(button.dataset.textAlign === settings.textAlign));
  });
}

function syncIconOptions() {
  const settings = state.stratsToolSettings;
  const labelInput = document.getElementById("strats-opt-icon-label");
  if (labelInput) {
    labelInput.value = settings.iconLabel;
  }

  document.querySelectorAll("[data-icon-id]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.iconId === settings.iconId);
    button.setAttribute("aria-pressed", String(button.dataset.iconId === settings.iconId));
  });
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
      commitSettingsChange();
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
    commitSettingsChange();
  });

  document.getElementById("strats-color-picker")?.addEventListener("input", (event) => {
    state.stratsToolSettings.color = event.target.value;
    syncColorUi();
    commitSettingsChange();
  });

  document.getElementById("strats-opt-size")?.addEventListener("input", (event) => {
    state.stratsToolSettings.size = Number(event.target.value);
    syncStrokeOptions();
    commitSettingsChange();
  });

  document.getElementById("strats-opt-shape-size")?.addEventListener("input", (event) => {
    state.stratsToolSettings.size = Number(event.target.value);
    syncShapeOptions();
    commitSettingsChange();
  });

  document.getElementById("strats-opt-font-size")?.addEventListener("input", (event) => {
    state.stratsToolSettings.fontSize = Number(event.target.value);
    syncTextOptions();
    commitSettingsChange();
  });

  document.getElementById("strats-opt-filled")?.addEventListener("change", (event) => {
    state.stratsToolSettings.filled = event.target.checked;
    commitSettingsChange();
  });

  document.getElementById("strats-opt-icon-label")?.addEventListener("input", (event) => {
    state.stratsToolSettings.iconLabel = event.target.value;
    commitSettingsChange();
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
    commitSettingsChange();
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
