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

const MAX_UNDO = 40;
const NUDGE_STEP = 0.15;
const PASTE_OFFSET = 0.8;

let svgLayer = null;
let previewLayer = null;
let handlesLayer = null;
let onObjectsChanged = null;
let onSelectionChange = null;
let onClipboardChange = null;
let selectedObjectId = null;
let clipboardObject = null;
let pasteIteration = 0;
let drawSession = null;
let objectDragSession = null;
let handleDragSession = null;
let activeMapViewer = null;

function getActiveSlideObjects() {
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  return slide?.objects || null;
}

function getSelectedObject() {
  if (!selectedObjectId) return null;
  return getActiveSlideObjects()?.find((object) => object.id === selectedObjectId) || null;
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
  onObjectsChanged?.();
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
  onObjectsChanged?.();
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
  if (selectedObjectId === objectId) {
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
    onObjectsChanged?.();
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

function isDrawingTool(tool) {
  return tool !== "select" && tool !== "eraser";
}

function shouldBlockMapPan() {
  if (state.appMode !== "strats" || !state.activeStrat) return false;
  const tool = state.stratsToolSettings.activeTool;
  return isDrawingTool(tool) || tool === "eraser" || Boolean(drawSession) || Boolean(objectDragSession) || Boolean(handleDragSession);
}

export function isStratsMapInteractionBlocked() {
  return shouldBlockMapPan();
}

export function hasStratsObjectSelection() {
  return Boolean(selectedObjectId);
}

export function hasStratsClipboard() {
  return Boolean(clipboardObject);
}

function isStratsEditingBlocked() {
  return !state.activeStrat || state.activeStrat.locked;
}

function offsetObjectPoints(points, multiplier) {
  const offset = PASTE_OFFSET * multiplier;
  return points.map((point) => ({
    x: Math.min(100, Math.max(0, point.x + offset)),
    y: Math.min(100, Math.max(0, point.y + offset)),
  }));
}

function createObjectCopy(source, offsetMultiplier = 1) {
  const copy = cloneStratObject(source);
  copy.id = `obj-${crypto.randomUUID()}`;
  copy.points = offsetObjectPoints(copy.points, offsetMultiplier);
  return copy;
}

function insertObjectCopy(copy) {
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  if (!slide || isStratsEditingBlocked()) return false;

  pushUndoSnapshot();
  slide.objects.push(copy);
  setSelectedObject(copy.id);
  commitObjectsChange({ snapshot: false });
  notifySelectionChange();
  return true;
}

function copySelectedObject() {
  const object = getSelectedObject();
  if (!object) return false;
  clipboardObject = cloneStratObject(object);
  pasteIteration = 0;
  notifyClipboardChange();
  return true;
}

function pasteClipboardObject() {
  if (!clipboardObject || isStratsEditingBlocked()) return false;
  pasteIteration += 1;
  return insertObjectCopy(createObjectCopy(clipboardObject, pasteIteration));
}

function cutSelectedObject() {
  if (!selectedObjectId || isStratsEditingBlocked()) return false;
  if (!copySelectedObject()) return false;
  removeObject(selectedObjectId);
  return true;
}

function notifySelectionChange() {
  onSelectionChange?.(getSelectedObject());
}

function notifyClipboardChange() {
  onClipboardChange?.();
}

function setSelectedObject(objectId, { notify = true } = {}) {
  selectedObjectId = objectId;
  refreshDrawLayer();
  if (notify) {
    notifySelectionChange();
  }
}

function createPreviewObject(type, points, meta = {}) {
  return createStratObject(type, {
    points,
    style: settingsToObjectStyle(state.stratsToolSettings),
    meta,
  });
}

function updateDrawPreview() {
  if (!drawSession) return;
  drawSession.preview = createPreviewObject(drawSession.type, drawSession.points, drawSession.meta || {});
  setPreviewObject(drawSession.preview);
}

function applyDrawConstraints(mapViewer, cursor, event) {
  if (!drawSession || drawSession.type === "pen") return;

  const anchor = drawSession.points[0];
  const aspect = getMapAspect(mapViewer);
  const modifiers = getDrawModifiers(event);
  drawSession.points = resolveTwoPointShape(drawSession.type, anchor, cursor, aspect, modifiers);
  updateDrawPreview();
}

function refreshActiveDrawFromModifiers() {
  if (!drawSession || !activeMapViewer || drawSession.cursor == null) return;
  applyDrawConstraints(activeMapViewer, drawSession.cursor, null);
  if (handleDragSession && handleDragSession.cursor) {
    applyHandleDragSession(activeMapViewer, handleDragSession.cursor, null);
  }
}

function finishDrawSession() {
  if (!drawSession) return;
  const { type, points, meta } = drawSession;
  drawSession = null;

  if (type === "pen" && points.length >= 2) {
    addObject(createPreviewObject(type, points));
    return;
  }

  if ((type === "line" || type === "arrow" || type === "rect" || type === "ellipse") && points.length >= 2) {
    const [a, b] = points;
    const aspect = activeMapViewer ? getMapAspect(activeMapViewer) : 1;
    if (visualDistance(a, b, aspect) < 0.15) return;
    addObject(createPreviewObject(type, points));
    return;
  }

  if ((type === "text" || type === "icon" || type === "ping") && points.length >= 1) {
    addObject(createPreviewObject(type, points, meta));
  }
}

function setPreviewObject(preview) {
  if (!previewLayer) return;
  previewLayer.replaceChildren();
  if (preview) {
    previewLayer.appendChild(renderStratObject(preview, { preview: true }));
  }
}

function renderHandlesOverlay() {
  if (!handlesLayer) return;
  handlesLayer.replaceChildren();
  const selected = getSelectedObject();
  if (!selected || state.stratsToolSettings.activeTool !== "select") return;
  handlesLayer.appendChild(renderSelectionOverlay(selected));
}

export function refreshDrawLayer() {
  if (!svgLayer) return;
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  const objects = slide?.objects || [];
  if (selectedObjectId && !objects.some((object) => object.id === selectedObjectId)) {
    setSelectedObject(null);
  }
  if (slide?.rasterUrl) {
    svgLayer.replaceChildren(
      objects.length ? renderStratObjects(objects, { selectedId: selectedObjectId }) : [],
    );
    setPreviewObject(drawSession?.preview || null);
    renderHandlesOverlay();
    return;
  }
  svgLayer.replaceChildren(renderStratObjects(objects, { selectedId: selectedObjectId }));
  setPreviewObject(drawSession?.preview || null);
  renderHandlesOverlay();
}

export function clearDrawLayer() {
  selectedObjectId = null;
  drawSession = null;
  objectDragSession = null;
  handleDragSession = null;
  if (svgLayer) svgLayer.replaceChildren();
  if (previewLayer) previewLayer.replaceChildren();
  if (handlesLayer) handlesLayer.replaceChildren();
  notifySelectionChange();
}

function applyHandleDragSession(mapViewer, cursor, event) {
  if (!handleDragSession) return;

  const modifiers = getDrawModifiers(event);
  const aspect = getMapAspect(mapViewer);
  const object = getSelectedObject();
  if (!object) return;

  updateObject(handleDragSession.objectId, (entry) => {
    const source = entry.type === "pen"
      ? { ...entry, points: handleDragSession.originalPoints }
      : entry;
    const result = applyHandleDrag(
      source,
      handleDragSession.handleId,
      cursor,
      aspect,
      modifiers,
      { penOriginalBox: handleDragSession.penOriginalBox }
    );
    if (result?.points) {
      entry.points = result.points;
    }
  }, { render: true });
}

function duplicateSelectedObject() {
  const object = getSelectedObject();
  if (!object || isStratsEditingBlocked()) return false;
  clipboardObject = cloneStratObject(object);
  pasteIteration = 0;
  return insertObjectCopy(createObjectCopy(object, 1));
}

function reorderSelectedObject(delta) {
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  if (!slide || !selectedObjectId) return;

  const objects = sortObjects(slide.objects);
  const index = objects.findIndex((object) => object.id === selectedObjectId);
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
  if (!selectedObjectId) return;
  pushUndoSnapshot();
  updateObject(selectedObjectId, (object) => {
    object.points = object.points.map((point) => ({
      x: Math.min(100, Math.max(0, point.x + dx)),
      y: Math.min(100, Math.max(0, point.y + dy)),
    }));
  });
}

function applySettingsToSelectedObject(settings) {
  if (!selectedObjectId) return;
  const object = getSelectedObject();
  if (!object) return;

  updateObject(selectedObjectId, (entry) => {
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
  onObjectsChanged?.();
}

const CONVERTIBLE_TYPES = {
  rect: ["ellipse"],
  ellipse: ["rect"],
  line: ["arrow"],
  arrow: ["line"],
};

function convertSelectedObjectType(newType) {
  if (!selectedObjectId) return;
  const object = getSelectedObject();
  if (!object) return;
  const allowed = CONVERTIBLE_TYPES[object.type];
  if (!allowed?.includes(newType)) return;

  pushUndoSnapshot();
  updateObject(selectedObjectId, (entry) => {
    entry.type = newType;
    if (newType === "arrow" && entry.style.endType === "none") {
      entry.style.endType = "end";
    }
  });
  notifySelectionChange();
}

function handlePointerDown(event, mapViewer) {
  if (state.appMode !== "strats" || !state.activeStrat || state.activeStrat.locked) return;
  if (event.button !== 0) return;

  activeMapViewer = mapViewer;
  const tool = state.stratsToolSettings.activeTool;
  const point = getMapPoint(event, mapViewer);

  if (tool === "select") {
    const selected = getSelectedObject();
    if (selected) {
      const handles = getSelectionHandles(selected);
      const handle = hitTestSelectionHandle(handles, point);
      if (handle) {
        event.stopPropagation();
        pushUndoSnapshot();
        handleDragSession = {
          objectId: selected.id,
          handleId: handle.id,
          pointerId: event.pointerId,
          originalPoints: structuredClone(selected.points),
          penOriginalBox: selected.type === "pen" ? getBoxFromObjectPoints(selected.points) : null,
          cursor: point,
        };
        mapViewer.viewport.setPointerCapture(event.pointerId);
        return;
      }
    }

    const hit = findTopObjectAt(point);
    if (hit) {
      event.stopPropagation();
      pushUndoSnapshot();
      setSelectedObject(hit.id, { notify: false });
      objectDragSession = {
        objectId: hit.id,
        startPoint: point,
        originalPoints: structuredClone(hit.points),
        pointerId: event.pointerId,
      };
      mapViewer.viewport.setPointerCapture(event.pointerId);
      notifySelectionChange();
      return;
    }

    setSelectedObject(null);
    return;
  }

  setSelectedObject(null);
  event.preventDefault();
  event.stopPropagation();

  if (tool === "eraser") {
    const hit = findTopObjectAt(point);
    if (hit) removeObject(hit.id);
    return;
  }

  if (tool === "text") {
    const text = window.prompt("Enter text", "") ?? "";
    if (!text.trim()) return;
    addObject(createPreviewObject("text", [point], { text: text.trim() }));
    return;
  }

  if (tool === "icons") {
    addObject(createPreviewObject("icon", [point], {
      iconId: state.stratsToolSettings.iconId,
      iconLabel: state.stratsToolSettings.iconLabel,
    }));
    return;
  }

  if (tool === "ping") {
    addObject(createPreviewObject("ping", [point]));
    return;
  }

  const drawType = tool === "arrow" ? "arrow" : tool;
  drawSession = {
    type: drawType,
    points: drawType === "pen" ? [point] : [point, point],
    cursor: point,
    pointerId: event.pointerId,
    preview: null,
  };

  if (drawType !== "pen") {
    applyDrawConstraints(mapViewer, point, event);
  } else {
    updateDrawPreview();
  }

  mapViewer.viewport.setPointerCapture(event.pointerId);
}

function handlePointerMove(event, mapViewer) {
  activeMapViewer = mapViewer;

  if (handleDragSession && event.pointerId === handleDragSession.pointerId) {
    event.stopPropagation();
    const point = getMapPoint(event, mapViewer);
    handleDragSession.cursor = point;
    applyHandleDragSession(mapViewer, point, event);
    return;
  }

  if (objectDragSession && event.pointerId === objectDragSession.pointerId) {
    event.stopPropagation();
    const point = getMapPoint(event, mapViewer);
    let dx = point.x - objectDragSession.startPoint.x;
    let dy = point.y - objectDragSession.startPoint.y;
    ({ dx, dy } = constrainDragDelta(
      objectDragSession.startPoint,
      dx,
      dy,
      getMapAspect(mapViewer),
      getDrawModifiers(event)
    ));

    updateObject(objectDragSession.objectId, (object) => {
      object.points = objectDragSession.originalPoints.map((entry) => ({
        x: Math.min(100, Math.max(0, entry.x + dx)),
        y: Math.min(100, Math.max(0, entry.y + dy)),
      }));
    });
    return;
  }

  if (!drawSession || event.pointerId !== drawSession.pointerId) return;

  event.stopPropagation();
  const point = getMapPoint(event, mapViewer);
  drawSession.cursor = point;

  if (drawSession.type === "pen") {
    const last = drawSession.points[drawSession.points.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.08) {
      drawSession.points.push(point);
    }
    updateDrawPreview();
    return;
  }

  applyDrawConstraints(mapViewer, point, event);
}

function handlePointerUp(event, mapViewer) {
  if (handleDragSession && event.pointerId === handleDragSession.pointerId) {
    event.stopPropagation();
    handleDragSession = null;
    onObjectsChanged?.();
    try {
      mapViewer.viewport.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    return;
  }

  if (objectDragSession && event.pointerId === objectDragSession.pointerId) {
    event.stopPropagation();
    objectDragSession = null;
    onObjectsChanged?.();
    try {
      mapViewer.viewport.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    return;
  }

  if (!drawSession || event.pointerId !== drawSession.pointerId) return;

  event.stopPropagation();
  if (drawSession.type !== "pen" && drawSession.cursor) {
    applyDrawConstraints(mapViewer, drawSession.cursor, event);
  }
  finishDrawSession();
  setPreviewObject(null);
  try {
    mapViewer.viewport.releasePointerCapture(event.pointerId);
  } catch {
    /* ignore */
  }
}

function handleDoubleClick(event, mapViewer) {
  if (state.appMode !== "strats" || state.stratsToolSettings.activeTool !== "select") return;
  const point = getMapPoint(event, mapViewer);
  const hit = findTopObjectAt(point);
  if (!hit || hit.type !== "text") return;

  event.stopPropagation();
  setSelectedObject(hit.id);
  const text = window.prompt("Edit text", hit.meta?.text || "") ?? "";
  if (!text.trim()) return;
  pushUndoSnapshot();
  updateObject(hit.id, (object) => {
    object.meta = { ...object.meta, text: text.trim() };
  });
  onObjectsChanged?.();
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
    if (selectedObjectId) {
      setSelectedObject(null);
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "c" && selectedObjectId) {
    event.preventDefault();
    copySelectedObject();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "x" && selectedObjectId) {
    event.preventDefault();
    cutSelectedObject();
    onObjectsChanged?.();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "v") {
    if (clipboardObject && !isStratsEditingBlocked()) {
      event.preventDefault();
      pasteClipboardObject();
      onObjectsChanged?.();
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "d" && selectedObjectId) {
    event.preventDefault();
    duplicateSelectedObject();
    onObjectsChanged?.();
    return;
  }

  if (selectedObjectId && state.stratsToolSettings.activeTool === "select") {
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

  if ((key === "delete" || key === "backspace") && selectedObjectId) {
    event.preventDefault();
    removeObject(selectedObjectId);
  }
}

export function initStratDrawing(mapViewer, { onChange, onSelect, onClipboard } = {}) {
  onObjectsChanged = onChange;
  onSelectionChange = onSelect;
  onClipboardChange = onClipboard;
  activeMapViewer = mapViewer;
  svgLayer = document.getElementById("strats-draw-layer");
  previewLayer = document.getElementById("strats-draw-preview");
  handlesLayer = document.getElementById("strats-handles-layer");

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

  mapViewer.shouldAllowPan = () => !shouldBlockMapPan();

  refreshDrawLayer();
}

export function resetStratDrawingHistory() {
  state.stratsUndoStack = [];
  state.stratsRedoStack = [];
  selectedObjectId = null;
  clipboardObject = null;
  pasteIteration = 0;
  drawSession = null;
  objectDragSession = null;
  handleDragSession = null;
}

export function getSelectedStratObjectId() {
  return selectedObjectId;
}

export function deleteSelectedStratObject() {
  if (!selectedObjectId) return;
  removeObject(selectedObjectId);
}

export function setStratSelectionChangeHandler(handler) {
  onSelectionChange = handler;
}

export {
  applySettingsToSelectedObject,
  convertSelectedObjectType,
  copySelectedObject,
  cutSelectedObject,
  duplicateSelectedObject,
  getSelectedObject,
  pasteClipboardObject,
  reorderSelectedObject,
};
