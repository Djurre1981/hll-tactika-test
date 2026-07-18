import {
  createStratObject,
  hitTestObject,
  settingsToObjectStyle,
  cloneStratObject,
  normalizePoint,
} from "./object-schema.js";
import {
  applyHandleDrag,
  getBoxFromObjectPoints,
  getSelectionHandles,
  hitTestSelectionHandle,
  nudgePoints,
} from "./selection-handles.js";

const PASTE_OFFSET = 0.8;
const NUDGE = 0.15;

function resolveTwoPoint(start, end, { shift = false, aspect = 1 } = {}) {
  if (!shift) return end;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const visualW = Math.abs(dx) * aspect;
  const visualH = Math.abs(dy);
  const size = Math.max(visualW, visualH);
  return {
    x: start.x + (Math.sign(dx || 1) * size) / aspect,
    y: start.y + Math.sign(dy || 1) * size,
  };
}

/** Pointer / keyboard interaction for drawing tools. */
export class InteractionController {
  constructor({ scene, renderer, getViewer, getToolSettings, onRequestRender }) {
    this.scene = scene;
    this.renderer = renderer;
    this.getViewer = getViewer;
    this.getToolSettings = getToolSettings;
    this.onRequestRender = onRequestRender;

    this.drawSession = null;
    this.objectDrag = null;
    this.handleDrag = null;
    this.clipboard = null;
    this.pasteIteration = 0;
    this.locked = false;

    this._onPointerDown = (e) => this.onPointerDown(e);
    this._onPointerMove = (e) => this.onPointerMove(e);
    this._onPointerUp = (e) => this.onPointerUp(e);
    this._onKeyDown = (e) => this.onKeyDown(e);
    this._onDblClick = (e) => this.onDblClick(e);
  }

  attach(viewport) {
    this.viewport = viewport;
    viewport.addEventListener("pointerdown", this._onPointerDown, true);
    window.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("pointercancel", this._onPointerUp);
    window.addEventListener("keydown", this._onKeyDown);
    viewport.addEventListener("dblclick", this._onDblClick);
  }

  detach() {
    if (!this.viewport) return;
    this.viewport.removeEventListener("pointerdown", this._onPointerDown, true);
    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);
    window.removeEventListener("pointercancel", this._onPointerUp);
    window.removeEventListener("keydown", this._onKeyDown);
    this.viewport.removeEventListener("dblclick", this._onDblClick);
    this.viewport = null;
  }

  setLocked(locked) {
    this.locked = Boolean(locked);
  }

  isDrawingTool(tool) {
    return tool !== "select" && tool !== "eraser";
  }

  shouldBlockPan() {
    const tool = this.getToolSettings().tool;
    return (
      this.isDrawingTool(tool) ||
      tool === "eraser" ||
      Boolean(this.drawSession) ||
      Boolean(this.objectDrag) ||
      Boolean(this.handleDrag)
    );
  }

  mapPoint(event) {
    return this.getViewer()?.screenToMapPercent(event.clientX, event.clientY);
  }

  refresh() {
    this.renderer.setSelectedId(this.scene.selectedId);
    this.renderer.setPreview(this.drawSession?.preview || null);
    this.onRequestRender();
  }

  onPointerDown(event) {
    if (this.locked || event.button !== 0) return;
    const viewer = this.getViewer();
    if (!viewer) return;

    const settings = this.getToolSettings();
    const tool = settings.tool;
    const point = this.mapPoint(event);
    if (!point) return;

    if (tool === "select") {
      const selected = this.scene.getSelected();
      if (selected) {
        const handle = hitTestSelectionHandle(getSelectionHandles(selected), point);
        if (handle) {
          event.stopImmediatePropagation();
          event.preventDefault();
          this.scene.pushUndo();
          this.handleDrag = {
            objectId: selected.id,
            handleId: handle.id,
            originalPoints: structuredClone(selected.points),
            penOriginalBox:
              selected.type === "pen" ? getBoxFromObjectPoints(selected.points) : null,
          };
          this.viewport.setPointerCapture?.(event.pointerId);
          this.getViewer()?.setBlockPan(true);
          return;
        }
      }

      const hit = this.scene.findTopAt(point, hitTestObject);
      if (hit) {
        event.stopImmediatePropagation();
        event.preventDefault();
        this.scene.pushUndo();
        this.scene.setSelectedId(hit.id);
        this.objectDrag = {
          objectId: hit.id,
          startPoint: point,
          originalPoints: structuredClone(hit.points),
        };
        this.viewport.setPointerCapture?.(event.pointerId);
        this.getViewer()?.setBlockPan(true);
        this.refresh();
        return;
      }

      this.scene.setSelectedId(null);
      this.refresh();
      return;
    }

    if (tool === "eraser") {
      event.stopImmediatePropagation();
      event.preventDefault();
      const hit = this.scene.findTopAt(point, hitTestObject);
      if (hit) {
        this.scene.removeObject(hit.id);
        this.refresh();
      }
      return;
    }

    if (tool === "text") {
      event.stopImmediatePropagation();
      event.preventDefault();
      const text = window.prompt("Text", "Text");
      if (text == null) return;
      const object = createStratObject("text", {
        points: [point],
        style: settingsToObjectStyle(settings),
        meta: { text: text.slice(0, 200) },
      });
      this.scene.addObject(object);
      this.scene.setSelectedId(object.id);
      this.refresh();
      return;
    }

    if (tool === "icons" || tool === "icon") {
      event.stopImmediatePropagation();
      event.preventDefault();
      const style = settingsToObjectStyle(settings);
      const object = createStratObject("icon", {
        // Single click → default square bbox (createStratObject expands to 2 points).
        points: [point],
        style,
        meta: { iconId: settings.iconId || "check", iconLabel: settings.iconLabel || "" },
      });
      this.scene.addObject(object);
      this.scene.setSelectedId(object.id);
      this.refresh();
      return;
    }

    if (tool === "hll") {
      event.stopImmediatePropagation();
      event.preventDefault();
      const object = createStratObject("hll", {
        points: [point],
        style: settingsToObjectStyle(settings),
        meta: {
          hllId: settings.hllId || "garrison",
          showRadius: settings.hllShowRadius !== false,
        },
      });
      this.scene.addObject(object);
      this.scene.setSelectedId(object.id);
      this.refresh();
      return;
    }

    if (tool === "ping") {
      event.stopImmediatePropagation();
      event.preventDefault();
      const object = createStratObject("ping", {
        points: [point],
        style: settingsToObjectStyle(settings),
      });
      this.scene.addObject(object);
      this.refresh();
      return;
    }

    const drawType = tool === "arrow" ? "arrow" : tool;
    if (!["pen", "line", "arrow", "rect", "ellipse"].includes(drawType)) return;

    event.stopImmediatePropagation();
    event.preventDefault();
    this.drawSession = {
      type: drawType,
      start: point,
      points: [point],
      pointerId: event.pointerId,
      preview: null,
    };
    this.viewport.setPointerCapture?.(event.pointerId);
    this.getViewer()?.setBlockPan(true);
    this.updateDrawPreview(point, event.shiftKey);
  }

  updateDrawPreview(point, shiftKey) {
    const session = this.drawSession;
    if (!session) return;
    const settings = this.getToolSettings();
    const style = settingsToObjectStyle(settings);
    const aspect = this.getViewer()?.getMapAspect() || 1;

    if (session.type === "pen") {
      session.points.push(normalizePoint(point));
      session.preview = createStratObject("pen", {
        points: session.points,
        style,
      });
    } else {
      const end = resolveTwoPoint(session.start, point, { shift: shiftKey, aspect });
      session.preview = createStratObject(session.type, {
        points: [session.start, end],
        style,
      });
    }
    this.refresh();
  }

  onPointerMove(event) {
    if (this.handleDrag) {
      event.stopPropagation();
      const point = this.mapPoint(event);
      this.scene.updateObject(this.handleDrag.objectId, (obj) => ({
        ...obj,
        points: applyHandleDrag(
          obj,
          this.handleDrag.handleId,
          point,
          this.handleDrag.originalPoints,
          this.handleDrag.penOriginalBox
        ),
      }));
      this.refresh();
      return;
    }

    if (this.objectDrag) {
      event.stopPropagation();
      const point = this.mapPoint(event);
      const dx = point.x - this.objectDrag.startPoint.x;
      const dy = point.y - this.objectDrag.startPoint.y;
      this.scene.updateObject(this.objectDrag.objectId, (obj) => ({
        ...obj,
        points: nudgePoints(this.objectDrag.originalPoints, dx, dy),
      }));
      this.refresh();
      return;
    }

    if (this.drawSession && this.drawSession.pointerId === event.pointerId) {
      event.stopPropagation();
      this.updateDrawPreview(this.mapPoint(event), event.shiftKey);
    }
  }

  onPointerUp(event) {
    if (this.handleDrag || this.objectDrag) {
      this.handleDrag = null;
      this.objectDrag = null;
      this.scene.emitChange({ reason: "drag-end" });
      this.getViewer()?.setBlockPan(this.shouldBlockPan());
      this.refresh();
      return;
    }

    const session = this.drawSession;
    if (!session || session.pointerId !== event.pointerId) return;

    event.stopPropagation();
    const preview = session.preview;
    this.drawSession = null;
    this.renderer.setPreview(null);
    this.getViewer()?.setBlockPan(this.shouldBlockPan());

    if (preview && (preview.type === "pen" ? preview.points.length >= 2 : true)) {
      if (preview.type !== "pen") {
        const [a, b] = preview.points;
        if (a && b && Math.hypot(b.x - a.x, b.y - a.y) < 0.15) {
          this.refresh();
          return;
        }
      }
      this.scene.addObject(preview);
      this.scene.setSelectedId(preview.id);
    }
    this.refresh();
  }

  onDblClick(event) {
    if (this.locked) return;
    const point = this.mapPoint(event);
    const hit = this.scene.findTopAt(point, hitTestObject);
    if (hit?.type === "text") {
      event.stopPropagation();
      const next = window.prompt("Text", hit.meta?.text || "Text");
      if (next == null) return;
      this.scene.updateObject(
        hit.id,
        (obj) => ({ ...obj, meta: { ...obj.meta, text: next.slice(0, 200) } }),
        { pushUndo: true }
      );
      this.refresh();
    }
  }

  onKeyDown(event) {
    if (this.locked) return;
    const target = event.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }

    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) this.scene.redo();
      else this.scene.undo();
      this.refresh();
      return;
    }
    if (mod && event.key.toLowerCase() === "y") {
      event.preventDefault();
      this.scene.redo();
      this.refresh();
      return;
    }
    if (mod && event.key.toLowerCase() === "c") {
      this.copy();
      return;
    }
    if (mod && event.key.toLowerCase() === "x") {
      this.cut();
      return;
    }
    if (mod && event.key.toLowerCase() === "v") {
      event.preventDefault();
      this.paste();
      return;
    }
    if (mod && event.key.toLowerCase() === "d") {
      event.preventDefault();
      this.copy();
      this.paste();
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      const selected = this.scene.getSelected();
      if (selected) {
        event.preventDefault();
        this.scene.removeObject(selected.id);
        this.refresh();
      }
      return;
    }

    const selected = this.scene.getSelected();
    if (!selected) return;
    const arrows = { ArrowUp: [0, -NUDGE], ArrowDown: [0, NUDGE], ArrowLeft: [-NUDGE, 0], ArrowRight: [NUDGE, 0] };
    const delta = arrows[event.key];
    if (delta) {
      event.preventDefault();
      this.scene.updateObject(
        selected.id,
        (obj) => ({ ...obj, points: nudgePoints(obj.points, delta[0], delta[1]) }),
        { pushUndo: true }
      );
      this.refresh();
    }
  }

  copy() {
    const selected = this.scene.getSelected();
    if (!selected) return;
    this.clipboard = cloneStratObject(selected);
    this.pasteIteration = 0;
  }

  cut() {
    this.copy();
    const selected = this.scene.getSelected();
    if (selected) {
      this.scene.removeObject(selected.id);
      this.refresh();
    }
  }

  paste() {
    if (!this.clipboard) return;
    this.pasteIteration += 1;
    const offset = PASTE_OFFSET * this.pasteIteration;
    const copy = cloneStratObject(this.clipboard);
    copy.id = `obj-${crypto.randomUUID()}`;
    copy.points = nudgePoints(copy.points, offset, offset);
    this.scene.addObject(copy);
    this.scene.setSelectedId(copy.id);
    this.refresh();
  }

  updateSelectedStyle(partial) {
    const selected = this.scene.getSelected();
    if (!selected) return;
    this.scene.updateObject(
      selected.id,
      (obj) => ({
        ...obj,
        style: { ...obj.style, ...partial.style },
        meta: partial.meta ? { ...obj.meta, ...partial.meta } : obj.meta,
      }),
      { pushUndo: true }
    );
    this.refresh();
  }
}
