import { state } from "../state.js";
import {
  createStratObject,
  normalizeStyle,
  settingsToObjectStyle,
} from "./strat-object-schema.js";
import { renderStratObject, renderSelectionOverlay } from "./strat-draw-render.js";
import {
  constrainDragDelta,
  getDrawModifiers,
  resolveTwoPointShape,
  visualDistance,
} from "./strat-draw-modifiers.js";
import {
  applyHandleDrag,
  getBoxFromObjectPoints,
} from "./strat-selection-handles.js";
import {
  getSvgLayer,
  getPreviewLayer,
  setPreviewLayer,
  getHandlesLayer,
  getDrawSession,
  setDrawSession,
  getHandleDragSession,
  getActiveMapViewer,
} from "./strat-drawing-state.js";
import {
  getSelectedObject,
  addObject,
  updateObject,
  getMapAspect,
  notifySelectionChange,
} from "./strat-drawing.js";

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

export {
  createPreviewObject,
  updateDrawPreview,
  applyDrawConstraints,
  refreshActiveDrawFromModifiers,
  finishDrawSession,
  setPreviewObject,
  renderHandlesOverlay,
  applyHandleDragSession,
};
