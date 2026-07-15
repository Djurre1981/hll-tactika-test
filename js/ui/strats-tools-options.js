import { state } from "../state.js";
import { STRAT_COLOR_PRESETS } from "../helpers/strat-defaults.js";
import {
  applySettingsToSelectedObject,
  hasStratsClipboard,
} from "../strats/strat-drawing.js";
import { getObjectTypeLabel } from "../strats/strat-selection-handles.js";

function normalizeHex(color) {
  return String(color || "").trim().toLowerCase();
}

export function syncClipboardButtons() {
  const pasteBtn = document.getElementById("strats-btn-paste");
  pasteBtn?.toggleAttribute("disabled", !hasStratsClipboard());
}

export function syncSelectionPanel(selectedObject) {
  const info = document.getElementById("strats-selection-info");
  const emptyHint = document.getElementById("strats-select-empty-hint");
  const typeEl = document.getElementById("strats-selection-type");
  const shapeConvert = document.getElementById("strats-shape-convert");
  const lineConvert = document.getElementById("strats-line-convert");
  const isEditingSelection = Boolean(selectedObject);

  info?.classList.toggle("hidden", !isEditingSelection);
  emptyHint?.classList.toggle("hidden", isEditingSelection);

  if (typeEl) {
    typeEl.textContent = isEditingSelection ? getObjectTypeLabel(selectedObject.type) : "";
  }

  shapeConvert?.classList.toggle("hidden", !isEditingSelection || !["rect", "ellipse"].includes(selectedObject?.type));
  lineConvert?.classList.toggle("hidden", !isEditingSelection || !["line", "arrow"].includes(selectedObject?.type));

  document.querySelectorAll("[data-convert-type]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.convertType === selectedObject?.type);
    button.setAttribute("aria-pressed", String(button.dataset.convertType === selectedObject?.type));
  });

  syncClipboardButtons();
}

export function loadSettingsFromObject(object) {
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

export function commitSettingsChange(selectedObject, onSettingsApplied) {
  if (selectedObject) {
    applySettingsToSelectedObject(state.stratsToolSettings);
    onSettingsApplied?.();
  }
}

export function syncColorUi() {
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

export function populateColorSwatches() {
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

export function syncStrokeOptions() {
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

export function syncShapeOptions() {
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

export function syncTextOptions() {
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

export function syncIconOptions() {
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
