import { DEFAULT_DRAW_SETTINGS } from "./whiteboardUi.js";

/** Map our panel settings → Excalidraw currentItem* appState. */
export function settingsToAppState(settings, toolId) {
  const s = { ...DEFAULT_DRAW_SETTINGS, ...settings };

  const base = {
    currentItemStrokeColor: s.strokeColor,
    currentItemBackgroundColor: s.backgroundColor,
    currentItemFillStyle: s.fillStyle,
    currentItemStrokeWidth: s.strokeWidth,
    currentItemStrokeStyle: s.strokeStyle,
    currentItemRoughness: s.roughness,
    currentItemOpacity: s.opacity,
    currentItemFontSize: s.fontSize,
    currentItemRoundness: s.roundness === "round" ? "round" : "sharp",
  };

  if (toolId === "sticky") {
    return {
      ...base,
      currentItemBackgroundColor:
        s.backgroundColor === "transparent" ? "#fef08a" : s.backgroundColor,
      currentItemStrokeColor: s.strokeColor || "#a16207",
      currentItemFillStyle: "solid",
    };
  }

  if (toolId === "image") {
    return {
      ...base,
      currentItemOpacity: 100,
    };
  }

  return base;
}

async function loadExcalidrawHelpers() {
  const mod = await import("@excalidraw/excalidraw");
  return {
    CaptureUpdateAction: mod.CaptureUpdateAction,
    newElementWith: mod.newElementWith,
  };
}

function patchSelectedElements(api, styleState, newElementWith) {
  const appState = api.getAppState();
  const selectedIds = appState.selectedElementIds || {};
  const hasSelection = Object.keys(selectedIds).some((id) => selectedIds[id]);
  if (!hasSelection) return null;

  const elements = api.getSceneElementsIncludingDeleted();
  let changed = false;

  const next = elements.map((el) => {
    if (!selectedIds[el.id] || el.isDeleted) return el;
    // Never restyle images from pen/theme settings.
    if (el.type === "image") return el;
    changed = true;
    return newElementWith(el, {
      strokeColor: styleState.currentItemStrokeColor,
      backgroundColor: styleState.currentItemBackgroundColor,
      fillStyle: styleState.currentItemFillStyle,
      strokeWidth: styleState.currentItemStrokeWidth,
      strokeStyle: styleState.currentItemStrokeStyle,
      roughness: styleState.currentItemRoughness,
      opacity: styleState.currentItemOpacity,
      ...(el.type === "text" ? { fontSize: styleState.currentItemFontSize } : {}),
    });
  });

  return changed ? next : null;
}

/**
 * Push draw settings into Excalidraw (current tool defaults + selected elements).
 * Pass `{ elements: false }` to only update tool defaults (e.g. theme chrome swap).
 */
export async function applyDrawSettings(api, toolId, settings, opts = {}) {
  if (!api) return;

  const { CaptureUpdateAction, newElementWith } = await loadExcalidrawHelpers();
  const styleState = settingsToAppState(settings, toolId);
  const patchElements = opts.elements !== false;
  const nextElements = patchElements
    ? patchSelectedElements(api, styleState, newElementWith)
    : null;

  api.updateScene({
    appState: styleState,
    ...(nextElements ? { elements: nextElements } : {}),
    captureUpdate: nextElements
      ? CaptureUpdateAction.IMMEDIATELY
      : CaptureUpdateAction.NEVER,
  });
}

/** Activate tool then apply styles after Excalidraw finishes the tool switch. */
export function applyToolAndSettings(api, toolId, settings) {
  if (!api) return;

  const excalTool =
    toolId === "sticky"
      ? "rectangle"
      : toolId === "highlighter"
        ? "freedraw"
        : toolId === "hll-map"
          ? "selection"
          : toolId;

  api.setActiveTool({ type: excalTool });

  setTimeout(() => {
    applyDrawSettings(api, toolId, settings);
  }, 0);
}
