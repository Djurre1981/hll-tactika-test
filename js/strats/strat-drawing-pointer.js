import { state } from "../state.js";
import {
  getDrawSession,
  setDrawSession,
  getObjectDragSession,
  setObjectDragSession,
  getHandleDragSession,
  setHandleDragSession,
  getSelectedObjectId,
  setActiveMapViewer,
  getOnObjectsChanged,
  getClipboardObject,
} from "./strat-drawing-state.js";
import {
  getActiveSlideObjects,
  getSelectedObject,
  pushUndoSnapshot,
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
} from "./strat-drawing.js";
import { setSelectedObject, notifySelectionChange } from "./strat-drawing-clipboard.js";
import { getSelectionHandles, hitTestSelectionHandle, getBoxFromObjectPoints } from "./strat-selection-handles.js";
import { constrainDragDelta, getDrawModifiers } from "./strat-draw-modifiers.js";

export function isDrawingTool(tool) {
  return tool !== "select" && tool !== "eraser";
}

export function shouldBlockMapPan() {
  if (state.appMode !== "strats" || !state.activeStrat) return false;
  const tool = state.stratsToolSettings.activeTool;
  return isDrawingTool(tool) || tool === "eraser" || Boolean(getDrawSession()) || Boolean(getObjectDragSession()) || Boolean(getHandleDragSession());
}

export function isStratsMapInteractionBlocked() {
  return shouldBlockMapPan();
}

export function hasStratsObjectSelection() {
  return Boolean(getSelectedObjectId());
}

export function hasStratsClipboard() {
  return Boolean(getClipboardObject());
}

export function isStratsEditingBlocked() {
  return !state.activeStrat || state.activeStrat.locked;
}

export function handlePointerDown(event, mapViewer) {
  if (state.appMode !== "strats" || !state.activeStrat || state.activeStrat.locked) return;
  if (event.button !== 0) return;

  setActiveMapViewer(mapViewer);
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
        setHandleDragSession({
          objectId: selected.id,
          handleId: handle.id,
          pointerId: event.pointerId,
          originalPoints: structuredClone(selected.points),
          penOriginalBox: selected.type === "pen" ? getBoxFromObjectPoints(selected.points) : null,
          cursor: point,
        });
        mapViewer.viewport.setPointerCapture(event.pointerId);
        return;
      }
    }

    const hit = findTopObjectAt(point);
    if (hit) {
      event.stopPropagation();
      pushUndoSnapshot();
      setSelectedObject(hit.id, { notify: false });
      setObjectDragSession({
        objectId: hit.id,
        startPoint: point,
        originalPoints: structuredClone(hit.points),
        pointerId: event.pointerId,
      });
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
  const session = {
    type: drawType,
    points: drawType === "pen" ? [point] : [point, point],
    cursor: point,
    pointerId: event.pointerId,
    preview: null,
  };
  setDrawSession(session);

  if (drawType !== "pen") {
    applyDrawConstraints(mapViewer, point, event);
  } else {
    updateDrawPreview();
  }

  mapViewer.viewport.setPointerCapture(event.pointerId);
}

export function handlePointerMove(event, mapViewer) {
  setActiveMapViewer(mapViewer);

  const hds = getHandleDragSession();
  if (hds && event.pointerId === hds.pointerId) {
    event.stopPropagation();
    const point = getMapPoint(event, mapViewer);
    hds.cursor = point;
    applyHandleDragSession(mapViewer, point, event);
    return;
  }

  const ods = getObjectDragSession();
  if (ods && event.pointerId === ods.pointerId) {
    event.stopPropagation();
    const point = getMapPoint(event, mapViewer);
    let dx = point.x - ods.startPoint.x;
    let dy = point.y - ods.startPoint.y;
    ({ dx, dy } = constrainDragDelta(
      ods.startPoint,
      dx,
      dy,
      getMapAspect(mapViewer),
      getDrawModifiers(event)
    ));

    updateObject(ods.objectId, (object) => {
      object.points = ods.originalPoints.map((entry) => ({
        x: Math.min(100, Math.max(0, entry.x + dx)),
        y: Math.min(100, Math.max(0, entry.y + dy)),
      }));
    });
    return;
  }

  const ds = getDrawSession();
  if (!ds || event.pointerId !== ds.pointerId) return;

  event.stopPropagation();
  const point = getMapPoint(event, mapViewer);
  ds.cursor = point;

  if (ds.type === "pen") {
    const last = ds.points[ds.points.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.08) {
      ds.points.push(point);
    }
    updateDrawPreview();
    return;
  }

  applyDrawConstraints(mapViewer, point, event);
}

export function handlePointerUp(event, mapViewer) {
  const hds = getHandleDragSession();
  if (hds && event.pointerId === hds.pointerId) {
    event.stopPropagation();
    setHandleDragSession(null);
    getOnObjectsChanged()?.();
    try {
      mapViewer.viewport.releasePointerCapture(event.pointerId);
    } catch { /* ignore */ }
    return;
  }

  const ods = getObjectDragSession();
  if (ods && event.pointerId === ods.pointerId) {
    event.stopPropagation();
    setObjectDragSession(null);
    getOnObjectsChanged()?.();
    try {
      mapViewer.viewport.releasePointerCapture(event.pointerId);
    } catch { /* ignore */ }
    return;
  }

  const ds = getDrawSession();
  if (!ds || event.pointerId !== ds.pointerId) return;

  event.stopPropagation();
  if (ds.type !== "pen" && ds.cursor) {
    applyDrawConstraints(mapViewer, ds.cursor, event);
  }
  finishDrawSession();
  setPreviewObject(null);
  try {
    mapViewer.viewport.releasePointerCapture(event.pointerId);
  } catch { /* ignore */ }
}

export function handleDoubleClick(event, mapViewer) {
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
  getOnObjectsChanged()?.();
  notifySelectionChange();
}
