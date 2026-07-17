import { state } from "../state.js";
import { getActiveSlide } from "../helpers/strat-defaults.js";
import { normalizeStratObjects, normalizeStyle, cloneStratObject, hitTestObject, settingsToObjectStyle } from "./strat-object-schema.js";
import { renderStratObjects, renderStratObject, renderSelectionOverlay } from "./strat-draw-render.js";
import { setSelectedObject, notifySelectionChange } from "./strat-drawing-clipboard.js";
import { createPreviewObject, updateDrawPreview, applyDrawConstraints, refreshActiveDrawFromModifiers, finishDrawSession, setPreviewObject, renderHandlesOverlay, applyHandleDragSession } from "./strat-drawing-preview.js";
import { bindDrawModifierTracking, constrainDragDelta, getDrawModifiers, resolveTwoPointShape, visualDistance } from "./strat-draw-modifiers.js";
import { applyHandleDrag, getBoxFromObjectPoints, getSelectionHandles, hitTestSelectionHandle } from "./strat-selection-handles.js";
import { isStratsMapInteractionBlocked, hasStratsObjectSelection, hasStratsClipboard, isStratsEditingBlocked, handlePointerDown, handlePointerMove, handlePointerUp, handleDoubleClick, isDrawingTool, shouldBlockMapPan } from "./strat-drawing-pointer.js";
import { handleKeyDown, isTypingTarget } from "./strat-drawing-keyboard.js";
import { copySelectedObject, cutSelectedObject, pasteClipboardObject, insertObjectCopy, createObjectCopy } from "./strat-drawing-clipboard.js";
import {
  getSvgLayer, setSvgLayer,
  getPreviewLayer, setPreviewLayer,
  getHandlesLayer, setHandlesLayer,
  getOnObjectsChanged, setOnObjectsChanged,
  getOnSelectionChange, setOnSelectionChange,
  getOnClipboardChange, setOnClipboardChange,
  getSelectedObjectId, setSelectedObjectId,
  getClipboardObject, setClipboardObject,
  getPasteIteration, setPasteIteration,
  getDrawSession, setDrawSession,
  getObjectDragSession, setObjectDragSession,
  getHandleDragSession, setHandleDragSession,
  getActiveMapViewer, setActiveMapViewer,
  MAX_UNDO, NUDGE_STEP,
} from "./strat-drawing-state.js";

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

function undoStratEdit() {
  if (!state.stratsUndoStack.length) return false;
  const current = structuredClone(getActiveSlideObjects() || []);
  const previous = state.stratsUndoStack.pop();
  state.stratsRedoStack.push(current);
  restoreObjects(previous);
  notifySelectionChange();
  return true;
}

function redoStratEdit() {
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

function removeObject(objectId) {
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

function refreshDrawLayer() {
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

function clearDrawLayer() {
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

function duplicateSelectedObject() {
  const object = getSelectedObject();
  if (!object || isStratsEditingBlocked()) return false;
  setClipboardObject(cloneStratObject(object));
  setPasteIteration(0);
  return insertObjectCopy(createObjectCopy(object, 1));
}

function sortObjects(objects) {
  return [...objects].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
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

function applySettingsToSelectedObject(settings) {
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

function convertSelectedObjectType(newType) {
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

function initStratDrawing(mapViewer, { onChange, onSelect, onClipboard } = {}) {
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

function resetStratDrawingHistory() {
  state.stratsUndoStack = [];
  state.stratsRedoStack = [];
  setSelectedObjectId(null);
  setClipboardObject(null);
  setPasteIteration(0);
  setDrawSession(null);
  setObjectDragSession(null);
  setHandleDragSession(null);
}

function getSelectedStratObjectId() {
  return getSelectedObjectId();
}

function deleteSelectedStratObject() {
  const id = getSelectedObjectId();
  if (!id) return;
  removeObject(id);
}

function setStratSelectionChangeHandler(handler) {
  setOnSelectionChange(handler);
}

export {
  getActiveSlideObjects,
  getSelectedObject,
  pushUndoSnapshot,
  restoreObjects,
  undoStratEdit,
  redoStratEdit,
  commitObjectsChange,
  addObject,
  removeObject,
  updateObject,
  findTopObjectAt,
  getMapPoint,
  getMapAspect,
  createPreviewObject,
  applyDrawConstraints,
  updateDrawPreview,
  finishDrawSession,
  setPreviewObject,
  applyHandleDragSession,
  refreshDrawLayer,
  clearDrawLayer,
  duplicateSelectedObject,
  reorderSelectedObject,
  sortObjects,
  nudgeSelectedObject,
  applySettingsToSelectedObject,
  convertSelectedObjectType,
  initStratDrawing,
  resetStratDrawingHistory,
  getSelectedStratObjectId,
  deleteSelectedStratObject,
  setStratSelectionChangeHandler,
  isDrawingTool,
  shouldBlockMapPan,
  isStratsMapInteractionBlocked,
  hasStratsObjectSelection,
  hasStratsClipboard,
  isStratsEditingBlocked,
  copySelectedObject,
  cutSelectedObject,
  pasteClipboardObject,
  notifySelectionChange,
};
