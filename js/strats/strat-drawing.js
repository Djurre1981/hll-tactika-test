import { state } from "../state.js";
import { getActiveSlide } from "../helpers/strat-defaults.js";
import {
  cloneStratObject,
  createStratObject,
  hitTestObject,
  normalizeStratObjects,
  normalizeStyle,
  settingsToObjectStyle,
} from "./strat-object-schema.js";
import { renderStratObject, renderStratObjects } from "./strat-draw-render.js";
import {
  bindDrawModifierTracking,
  constrainDragDelta,
  getDrawModifiers,
  resolveTwoPointShape,
  visualDistance,
} from "./strat-draw-modifiers.js";
import {
  applyHandleDrag,
  getBoxFromObjectPoints,
  getSelectionHandles,
  hitTestSelectionHandle,
  renderSelectionOverlay,
} from "./strat-selection-handles.js";
import {
  getSvgLayer,
  setSvgLayer,
  getPreviewLayer,
  setPreviewLayer,
  getHandlesLayer,
  setHandlesLayer,
  getOnObjectsChanged,
  setOnObjectsChanged,
  getOnSelectionChange,
  setOnSelectionChange,
  getOnClipboardChange,
  setOnClipboardChange,
  getSelectedObjectId,
  setSelectedObjectId,
  getClipboardObject,
  setClipboardObject,
  getPasteIteration,
  setPasteIteration,
  getDrawSession,
  setDrawSession,
  getObjectDragSession,
  setObjectDragSession,
  getHandleDragSession,
  setHandleDragSession,
  getActiveMapViewer,
  MAX_UNDO,
  NUDGE_STEP,
} from "./strat-drawing-state.js";
import { setSelectedObject, copySelectedObject, pasteClipboardObject, cutSelectedObject, insertObjectCopy, createObjectCopy, notifySelectionChange } from "./strat-drawing-clipboard.js";
import { isStratsMapInteractionBlocked, hasStratsObjectSelection, hasStratsClipboard, isStratsEditingBlocked, handlePointerDown, handlePointerMove, handlePointerUp, handleDoubleClick, isDrawingTool } from "./strat-drawing-pointer.js";

function getActiveSlideObjects() {
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  return slide?.objects || null;
}

function getSelectedObject() {
  const id = getSelectedObjectId();
  if (!id) return null;
  return getActiveSlideObjects()?.find((object) => object.id === id) || null;
}

function pushUndoSnapshot() {
  const objects = getActiveSlideObjects();
  if (!objects) return;
  state.stratsUndoStack.push(structuredClone(objects));
  if (state.stratsUndoStack.length > MAX_UNDO) {
    state.stratsUndoStack.shift();
  }
  state.stratsRedoStack = [];
}

function restoreObjects(objects) {
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  if (!slide) return;
  slide.objects = normalizeStratObjects(objects);
  refreshDrawLayer();
  getOnObjectsChanged()?.();
}

export function undoStratEdit() {
  if (!state.stratsUndoStack.length) return false;
  const current = structuredClone(getActiveSlideObjects() || []);
  const previous = state.stratsUndoStack.pop();
  state.stratsRedoStack.push(current);
  restoreObjects(previous);
  notifySelectionChange();
  return true;
}

export function redoStratEdit() {
  if (!state.stratsRedoStack.length) return false;
  const current = structuredClone(getActiveSlideObjects() || []);
  const next = state.stratsRedoStack.pop();
  state.stratsUndoStack.push(current);
  restoreObjects(next);
  notifySelectionChange();
  return true;
}

function commitObjectsChange({ snapshot = true } = {}) {
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  if (!slide) return;
  slide.objects = normalizeStratObjects(slide.objects);
  if (snapshot) {
    pushUndoSnapshot();
  }
  refreshDrawLayer();
  getOnObjectsChanged()?.();
}

function addObject(object, { snapshot = true } = {}) {
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  if (!slide) return;
  if (snapshot) pushUndoSnapshot();
  slide.objects.push(object);
  setSelectedObject(object.id, { notify: false });
  commitObjectsChange({ snapshot: false });
  notifySelectionChange();
}

export function removeObject(objectId) {
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  if (!slide) return;
  pushUndoSnapshot();
  slide.objects = slide.objects.filter((object) => object.id !== objectId);
  if (getSelectedObjectId() === objectId) {
    setSelectedObject(null, { notify: false });
  }
  commitObjectsChange({ snapshot: false });
  notifySelectionChange();
}

function updateObject(objectId, updater, { render = true } = {}) {
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  if (!slide) return;
  const object = slide.objects.find((entry) => entry.id === objectId);
  if (!object) return;
  updater(object);
  if (render) {
    refreshDrawLayer();
    getOnObjectsChanged()?.();
  }
}

function findTopObjectAt(point) {
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  if (!slide) return null;
  const sorted = [...slide.objects].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
  return sorted.find((object) => hitTestObject(object, point)) || null;
}

function getMapPoint(event, mapViewer) {
  return mapViewer.screenToMapPercent(event.clientX, event.clientY);
}

function getMapAspect(mapViewer) {
  const img = mapViewer.image;
  const w = img.naturalWidth || img.width || 1;
  const h = img.naturalHeight || img.height || 1;
  return w / h;
}

function createPreviewObject(type, points, meta = {}) {
  return createStratObject(type, {
    points,
    style: settingsToObjectStyle(state.stratsToolSettings),
    meta,
  });
}

function updateDrawPreview() {
  const ds = getDrawSession();
  if (!ds) return;
  ds.preview = createPreviewObject(ds.type, ds.points, ds.meta || {});
  setPreviewObject(ds.preview);
}

function applyDrawConstraints(mapViewer, cursor, event) {
  const ds = getDrawSession();
  if (!ds || ds.type === "pen") return;

  const anchor = ds.points[0];
  const aspect = getMapAspect(mapViewer);
  const modifiers = getDrawModifiers(event);
  ds.points = resolveTwoPointShape(ds.type, anchor, cursor, aspect, modifiers);
  updateDrawPreview();
}

function refreshActiveDrawFromModifiers() {
  const ds = getDrawSession();
  const av = getActiveMapViewer();
  if (!ds || !av || ds.cursor == null) return;
  applyDrawConstraints(av, ds.cursor, null);
  const hds = getHandleDragSession();
  if (hds && hds.cursor) {
    applyHandleDragSession(av, hds.cursor, null);
  }
}

function finishDrawSession() {
  const ds = getDrawSession();
  if (!ds) return;
  const { type, points, meta } = ds;
  setDrawSession(null);

  if (type === "pen" && points.length >= 2) {
    addObject(createPreviewObject(type, points));
    return;
  }

  if ((type === "line" || type === "arrow" || type === "rect" || type === "ellipse") && points.length >= 2) {
    const [a, b] = points;
    const aspect = getActiveMapViewer() ? getMapAspect(getActiveMapViewer()) : 1;
    if (visualDistance(a, b, aspect) < 0.15) return;
    addObject(createPreviewObject(type, points));
    return;
  }

  if ((type === "text" || type === "icon" || type === "ping") && points.length >= 1) {
    addObject(createPreviewObject(type, points, meta));
  }
}

function setPreviewObject(preview) {
  const layer = getPreviewLayer();
  if (!layer) return;
  layer.replaceChildren();
  if (preview) {
    layer.appendChild(renderStratObject(preview, { preview: true }));
  }
}

function renderHandlesOverlay() {
  const layer = getHandlesLayer();
  if (!layer) return;
  layer.replaceChildren();
  const selected = getSelectedObject();
  if (!selected || state.stratsToolSettings.activeTool !== "select") return;
  layer.appendChild(renderSelectionOverlay(selected));
}

export function refreshDrawLayer() {
  const layer = getSvgLayer();
  if (!layer) return;
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  const objects = slide?.objects || [];
  const sid = getSelectedObjectId();
  if (sid && !objects.some((object) => object.id === sid)) {
    setSelectedObject(null);
  }
  if (slide?.rasterUrl) {
    layer.replaceChildren(
      objects.length ? renderStratObjects(objects, { selectedId: sid }) : [],
    );
    setPreviewObject(getDrawSession()?.preview || null);
    renderHandlesOverlay();
    return;
  }
  layer.replaceChildren(renderStratObjects(objects, { selectedId: sid }));
  setPreviewObject(getDrawSession()?.preview || null);
  renderHandlesOverlay();
}

export function clearDrawLayer() {
  setSelectedObjectId(null);
  setDrawSession(null);
  setObjectDragSession(null);
  setHandleDragSession(null);
  const svg = getSvgLayer();
  if (svg) svg.replaceChildren();
  const preview = getPreviewLayer();
  if (preview) preview.replaceChildren();
  const handles = getHandlesLayer();
  if (handles) handles.replaceChildren();
  notifySelectionChange();
}

function applyHandleDragSession(mapViewer, cursor, event) {
  const hds = getHandleDragSession();
  if (!hds) return;

  const modifiers = getDrawModifiers(event);
  const aspect = getMapAspect(mapViewer);
  const object = getSelectedObject();
  if (!object) return;

  updateObject(hds.objectId, (entry) => {
    const source = entry.type === "pen"
      ? { ...entry, points: hds.originalPoints }
      : entry;
    const result = applyHandleDrag(
      source,
      hds.handleId,
      cursor,
      aspect,
      modifiers,
      { penOriginalBox: hds.penOriginalBox }
    );
    if (result?.points) {
      entry.points = result.points;
    }
  }, { render: true });
}

function duplicateSelectedObject() {
  const object = getSelectedObject();
  if (!object || isStratsEditingBlocked()) return false;
  setClipboardObject(cloneStratObject(object));
  setPasteIteration(0);
  return insertObjectCopy(createObjectCopy(object, 1));
}

function reorderSelectedObject(delta) {
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  if (!slide || !getSelectedObjectId()) return;

  const objects = sortObjects(slide.objects);
  const index = objects.findIndex((object) => object.id === getSelectedObjectId());
  const target = index + delta;
  if (index < 0 || target < 0 || target >= objects.length) return;

  pushUndoSnapshot();
  [objects[index], objects[target]] = [objects[target], objects[index]];
  objects.forEach((object, order) => {
    object.zIndex = order;
  });
  slide.objects = objects;
  commitObjectsChange({ snapshot: false });
}

function sortObjects(objects) {
  return [...objects].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

function nudgeSelectedObject(dx, dy) {
  const id = getSelectedObjectId();
  if (!id) return;
  pushUndoSnapshot();
  updateObject(id, (object) => {
    object.points = object.points.map((point) => ({
      x: Math.min(100, Math.max(0, point.x + dx)),
      y: Math.min(100, Math.max(0, point.y + dy)),
    }));
  });
}

export function applySettingsToSelectedObject(settings) {
  const id = getSelectedObjectId();
  if (!id) return;
  const object = getSelectedObject();
  if (!object) return;

  updateObject(id, (entry) => {
    entry.style = normalizeStyle({
      ...entry.style,
      color: settings.color ?? entry.style.color,
      size: settings.size ?? entry.style.size,
      lineType: settings.lineType ?? entry.style.lineType,
      endType: settings.endType ?? entry.style.endType,
      filled: settings.filled ?? entry.style.filled,
      fontSize: settings.fontSize ?? entry.style.fontSize,
      textStyle: settings.textStyle ?? entry.style.textStyle,
      textAlign: settings.textAlign ?? entry.style.textAlign,
    }, entry.type);

    if (entry.type === "text" && settings.textContent != null) {
      entry.meta = { ...entry.meta, text: settings.textContent };
    }
    if (entry.type === "icon") {
      if (settings.iconId != null) entry.meta = { ...entry.meta, iconId: settings.iconId };
      if (settings.iconLabel != null) entry.meta = { ...entry.meta, iconLabel: settings.iconLabel };
    }
  });
  getOnObjectsChanged()?.();
}

const CONVERTIBLE_TYPES = {
  rect: ["ellipse"],
  ellipse: ["rect"],
  line: ["arrow"],
  arrow: ["line"],
};

export function convertSelectedObjectType(newType) {
  const id = getSelectedObjectId();
  if (!id) return;
  const object = getSelectedObject();
  if (!object) return;
  const allowed = CONVERTIBLE_TYPES[object.type];
  if (!allowed?.includes(newType)) return;

  pushUndoSnapshot();
  updateObject(id, (entry) => {
    entry.type = newType;
    if (newType === "arrow" && entry.style.endType === "none") {
      entry.style.endType = "end";
    }
  });
  notifySelectionChange();
}

function isTypingTarget(target) {
  return target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']");
}

function handleKeyDown(event) {
  if (state.appMode !== "strats" || !state.activeStrat) return;
  if (isTypingTarget(event.target)) return;

  const key = event.key.toLowerCase();

  if (key === "escape") {
    if (getSelectedObjectId()) {
      setSelectedObject(null);
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "c" && getSelectedObjectId()) {
    event.preventDefault();
    copySelectedObject();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "x" && getSelectedObjectId()) {
    event.preventDefault();
    cutSelectedObject();
    getOnObjectsChanged()?.();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "v") {
    if (getClipboardObject() && !isStratsEditingBlocked()) {
      event.preventDefault();
      pasteClipboardObject();
      getOnObjectsChanged()?.();
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "d" && getSelectedObjectId()) {
    event.preventDefault();
    duplicateSelectedObject();
    getOnObjectsChanged()?.();
    return;
  }

  const sid = getSelectedObjectId();
  if (sid && state.stratsToolSettings.activeTool === "select") {
    if (key === "[" ) {
      event.preventDefault();
      reorderSelectedObject(-1);
      return;
    }
    if (key === "]") {
      event.preventDefault();
      reorderSelectedObject(1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      nudgeSelectedObject(-NUDGE_STEP, 0);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      nudgeSelectedObject(NUDGE_STEP, 0);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      nudgeSelectedObject(0, -NUDGE_STEP);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      nudgeSelectedObject(0, NUDGE_STEP);
      return;
    }
  }

  if ((event.ctrlKey || event.metaKey) && key === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      redoStratEdit();
    } else {
      undoStratEdit();
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "y") {
    event.preventDefault();
    redoStratEdit();
    return;
  }

  if ((key === "delete" || key === "backspace") && getSelectedObjectId()) {
    event.preventDefault();
    removeObject(getSelectedObjectId());
  }
}

export function initStratDrawing(mapViewer, { onChange, onSelect, onClipboard } = {}) {
  setOnObjectsChanged(onChange);
  setOnSelectionChange(onSelect);
  setOnClipboardChange(onClipboard);
  setActiveMapViewer(mapViewer);
  setSvgLayer(document.getElementById("strats-draw-layer"));
  setPreviewLayer(document.getElementById("strats-draw-preview"));
  setHandlesLayer(document.getElementById("strats-handles-layer"));

  bindDrawModifierTracking({
    onChange: () => {
      refreshActiveDrawFromModifiers();
    },
  });

  const viewport = mapViewer.viewport;
  viewport.addEventListener("pointerdown", (event) => handlePointerDown(event, mapViewer), { capture: true });
  viewport.addEventListener("dblclick", (event) => handleDoubleClick(event, mapViewer), { capture: true });
  window.addEventListener("pointermove", (event) => handlePointerMove(event, mapViewer));
  window.addEventListener("pointerup", (event) => handlePointerUp(event, mapViewer));
  window.addEventListener("keydown", handleKeyDown);

  mapViewer.shouldAllowPan = () => !isStratsMapInteractionBlocked();

  refreshDrawLayer();
}

export function resetStratDrawingHistory() {
  state.stratsUndoStack = [];
  state.stratsRedoStack = [];
  setSelectedObjectId(null);
  setClipboardObject(null);
  setPasteIteration(0);
  setDrawSession(null);
  setObjectDragSession(null);
  setHandleDragSession(null);
}

export function getSelectedStratObjectId() {
  return getSelectedObjectId();
}

export function deleteSelectedStratObject() {
  const id = getSelectedObjectId();
  if (!id) return;
  removeObject(id);
}

export function setStratSelectionChangeHandler(handler) {
  setOnSelectionChange(handler);
}

export {
  copySelectedObject,
  cutSelectedObject,
  duplicateSelectedObject,
  getSelectedObject,
  pasteClipboardObject,
  reorderSelectedObject,
};
