import {
  createStratObject,
  hitTestObject,
  settingsToObjectStyle,
  cloneStratObject,
  normalizePoint,
  cubicPointsFromEndpoints,
  textBoxFromCenter,
} from "./object-schema.js";
import {
  applyHandleDrag,
  getBoxFromObjectPoints,
  getSelectionHandles,
  hitTestSelectionHandle,
  curveHandleHitPct,
  nudgePoints,
  rotationDegreesFromCursor,
} from "./selection-handles.js";
import { isGarrisonPlacementValid } from "./icons/hll-object-catalog.js";

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
  constructor({
    scene,
    renderer,
    getViewer,
    getToolSettings,
    shouldAutoSelectOnCreate,
    onRequestRender,
    onRequestTool,
    onEyedrop,
    sampleColorAt,
    beginTextEdit,
    isTextEditing,
  }) {
    this.scene = scene;
    this.renderer = renderer;
    this.getViewer = getViewer;
    this.getToolSettings = getToolSettings;
    this.shouldAutoSelectOnCreate = shouldAutoSelectOnCreate || (() => true);
    this.onRequestRender = onRequestRender;
    this.onRequestTool = onRequestTool || null;
    this.onEyedrop = onEyedrop || null;
    this.sampleColorAt = sampleColorAt || null;
    this.beginTextEdit = beginTextEdit || null;
    this.isTextEditing = isTextEditing || (() => false);

    this.drawSession = null;
    this.strokeChain = null;
    this.objectDrag = null;
    this.handleDrag = null;
    this.clipboard = null;
    this.pasteIteration = 0;
    this.locked = false;
    this.hllPlacementPreview = null;

    this._onPointerDown = (e) => this.onPointerDown(e);
    this._onPointerMove = (e) => this.onPointerMove(e);
    this._onPointerUp = (e) => this.onPointerUp(e);
    this._onKeyDown = (e) => this.onKeyDown(e);
    this._onDblClick = (e) => this.onDblClick(e);
    this._onContextMenu = (e) => this.onContextMenu(e);
  }

  attach(viewport) {
    this.viewport = viewport;
    viewport.addEventListener("pointerdown", this._onPointerDown, true);
    window.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("pointercancel", this._onPointerUp);
    window.addEventListener("keydown", this._onKeyDown);
    viewport.addEventListener("dblclick", this._onDblClick);
    viewport.addEventListener("contextmenu", this._onContextMenu);
  }

  detach() {
    if (!this.viewport) return;
    this.viewport.removeEventListener("pointerdown", this._onPointerDown, true);
    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);
    window.removeEventListener("pointercancel", this._onPointerUp);
    window.removeEventListener("keydown", this._onKeyDown);
    this.viewport.removeEventListener("dblclick", this._onDblClick);
    this.viewport.removeEventListener("contextmenu", this._onContextMenu);
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
      Boolean(this.strokeChain) ||
      Boolean(this.objectDrag) ||
      Boolean(this.handleDrag) ||
      this.isTextEditing()
    );
  }

  mapPoint(event) {
    return this.getViewer()?.screenToMapPercent(event.clientX, event.clientY);
  }

  refresh() {
    this.renderer.setSelectedId(this.scene.selectedId);
    this.renderer.setPreview(
      this.strokeChain?.preview || this.drawSession?.preview || this.hllPlacementPreview || null
    );
    this.onRequestRender();
  }

  maybeSelectAfterCreate(id) {
    if (this.shouldAutoSelectOnCreate()) {
      this.scene.setSelectedId(id);
    }
  }

  isHllGarrisonRadiusCheckActive(settings = this.getToolSettings()) {
    return (
      settings.tool === "hll" &&
      (settings.hllId || "garrison") === "garrison" &&
      settings.hllRadiusCheck !== false
    );
  }

  clearHllPlacementPreview() {
    if (!this.hllPlacementPreview) return;
    this.hllPlacementPreview = null;
    this.refresh();
  }

  onToolSettingsChanged() {
    if (!this.isStrokeChainTool()) {
      this.cancelStrokeChain();
    }
    if (!this.isHllGarrisonRadiusCheckActive()) {
      this.clearHllPlacementPreview();
    }
  }

  /** Line / curve / arrow place as click-chains (next LMB continues). */
  isStrokeChainTool(settings = this.getToolSettings()) {
    const tool = settings.tool;
    return tool === "line" || tool === "curve" || tool === "arrow";
  }

  strokeChainObjectType(settings = this.getToolSettings()) {
    const tool = settings.tool;
    if (tool === "arrow") return "line";
    if (tool === "line" && settings.lineBezier) return "curve";
    return tool === "curve" ? "curve" : "line";
  }

  cancelStrokeChain() {
    if (!this.strokeChain) return;
    this.strokeChain = null;
    this.renderer.setPreview(null);
    this.getViewer()?.setBlockPan(this.shouldBlockPan());
    this.refresh();
  }

  updateStrokeChainPreview(point, shiftKey = false) {
    const chain = this.strokeChain;
    if (!chain || !point) return;
    const settings = this.getToolSettings();
    const style = settingsToObjectStyle(settings);
    const aspect = this.getViewer()?.getMapAspect() || 1;
    const end = resolveTwoPoint(chain.lastPoint, point, { shift: shiftKey, aspect });
    if (chain.type === "curve") {
      chain.preview = createStratObject("curve", {
        points: cubicPointsFromEndpoints(chain.lastPoint, end),
        style,
      });
    } else {
      chain.preview = createStratObject("line", {
        points: [chain.lastPoint, end],
        style,
      });
    }
    this.refresh();
  }

  placeStrokeChainSegment(point, shiftKey = false) {
    const chain = this.strokeChain;
    if (!chain || !point) return;
    const settings = this.getToolSettings();
    const style = settingsToObjectStyle(settings);
    const aspect = this.getViewer()?.getMapAspect() || 1;
    const end = resolveTwoPoint(chain.lastPoint, point, { shift: shiftKey, aspect });
    const dist = Math.hypot(end.x - chain.lastPoint.x, end.y - chain.lastPoint.y);
    if (dist >= 0.15) {
      const object =
        chain.type === "curve"
          ? createStratObject("curve", {
              points: cubicPointsFromEndpoints(chain.lastPoint, end),
              style,
            })
          : createStratObject("line", {
              points: [chain.lastPoint, end],
              style,
            });
      this.scene.addObject(object);
      this.maybeSelectAfterCreate(object.id);
    }
    chain.lastPoint = end;
    this.updateStrokeChainPreview(point, shiftKey);
  }

  updateHllPlacementPreview(point) {
    const settings = this.getToolSettings();
    if (!this.isHllGarrisonRadiusCheckActive(settings) || !point) {
      this.clearHllPlacementPreview();
      return;
    }
    const placeOk = isGarrisonPlacementValid(point, this.scene.getObjects());
    this.hllPlacementPreview = createStratObject("hll", {
      points: [point],
      style: settingsToObjectStyle(settings),
      meta: {
        hllId: "garrison",
        showRadius: settings.hllShowRadius !== false,
        placementPreview: true,
        placeOk,
      },
    });
    this.refresh();
  }

  /** Right-click: cancel in-progress draw and return to Select (CAD-style finish). */
  activateSelectTool() {
    if (this.drawSession) {
      this.drawSession = null;
      this.renderer.setPreview(null);
    }
    this.cancelStrokeChain();
    this.clearHllPlacementPreview();
    this.handleDrag = null;
    this.objectDrag = null;
    if (this.getToolSettings().tool !== "select") {
      this.onRequestTool?.("select");
    }
    this.getViewer()?.setBlockPan(this.shouldBlockPan());
    this.refresh();
  }

  onContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    if (this.locked) return;
    this.activateSelectTool();
  }

  onPointerDown(event) {
    if (this.locked) return;
    if (this.isTextEditing()) {
      // Let the textarea handle its own events; outside clicks blur → commit.
      if (event.target?.tagName === "TEXTAREA") return;
    }
    if (event.button === 2) {
      event.stopImmediatePropagation();
      event.preventDefault();
      this.activateSelectTool();
      return;
    }
    if (event.button !== 0) return;
    const viewer = this.getViewer();
    if (!viewer) return;

    const settings = this.getToolSettings();
    if (settings.eyedropTarget && this.sampleColorAt && this.onEyedrop) {
      event.stopImmediatePropagation();
      event.preventDefault();
      const hex = this.sampleColorAt(event.clientX, event.clientY);
      if (hex) this.onEyedrop(hex, settings.eyedropTarget);
      return;
    }

    const tool = settings.tool;
    const point = this.mapPoint(event);
    if (!point) return;

    if (tool === "select") {
      const selected = this.scene.getSelected();
      if (selected) {
        const handleHit = curveHandleHitPct(
          this.getViewer()?.getCamera?.()?.zoom,
          this.renderer?.mapSize
        );
        const handle = hitTestSelectionHandle(
          getSelectionHandles(selected),
          point,
          handleHit
        );
        if (handle) {
          event.stopImmediatePropagation();
          event.preventDefault();
          this.handleDrag = {
            objectId: selected.id,
            handleId: handle.id,
            originalPoints: structuredClone(selected.points),
            originalRotation: Number(selected.style?.rotation) || 0,
            penOriginalBox:
              selected.type === "pen" ? getBoxFromObjectPoints(selected.points) : null,
            undoPushed: false,
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
        this.scene.setSelectedId(hit.id);
        this.objectDrag = {
          objectId: hit.id,
          startPoint: point,
          originalPoints: structuredClone(hit.points),
          undoPushed: false,
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
      this.maybeSelectAfterCreate(object.id);
      this.refresh();
      return;
    }

    if (tool === "hll") {
      event.stopImmediatePropagation();
      event.preventDefault();
      const hllId = settings.hllId || "garrison";
      if (
        hllId === "garrison" &&
        settings.hllRadiusCheck !== false &&
        !isGarrisonPlacementValid(point, this.scene.getObjects())
      ) {
        this.updateHllPlacementPreview(point);
        return;
      }
      const object = createStratObject("hll", {
        points: [point],
        style: settingsToObjectStyle(settings),
        meta: {
          hllId,
          showRadius: settings.hllShowRadius !== false,
        },
      });
      this.scene.addObject(object);
      this.maybeSelectAfterCreate(object.id);
      this.updateHllPlacementPreview(point);
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

    const drawType =
      tool === "arrow"
        ? "line"
        : tool === "line" && settings.lineBezier
          ? "curve"
          : tool;

    // Line / curve / arrow: click-chain — each LMB places a segment and continues.
    if (this.isStrokeChainTool(settings)) {
      event.stopImmediatePropagation();
      event.preventDefault();
      const chainType = this.strokeChainObjectType(settings);
      if (!this.strokeChain) {
        this.strokeChain = {
          type: chainType,
          lastPoint: normalizePoint(point),
          preview: null,
        };
        this.getViewer()?.setBlockPan(true);
        this.updateStrokeChainPreview(point, event.shiftKey);
      } else {
        // Tool options may change mid-chain (e.g. Bezier toggle).
        this.strokeChain.type = chainType;
        this.placeStrokeChainSegment(point, event.shiftKey);
      }
      return;
    }

    if (!["pen", "rect", "ellipse", "text"].includes(drawType)) return;

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
    } else if (session.type === "curve") {
      const end = resolveTwoPoint(session.start, point, { shift: shiftKey, aspect });
      session.preview = createStratObject("curve", {
        points: cubicPointsFromEndpoints(session.start, end),
        style,
      });
    } else if (session.type === "text") {
      const end = resolveTwoPoint(session.start, point, { shift: shiftKey, aspect });
      session.preview = createStratObject("text", {
        points: [session.start, end],
        style,
        meta: { text: "add text here" },
      });
      session.preview.meta.draft = true;
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
      if (!this.handleDrag.undoPushed) {
        this.scene.pushUndo();
        this.handleDrag.undoPushed = true;
      }
      if (this.handleDrag.handleId === "rotate") {
        const deg = rotationDegreesFromCursor(
          { points: this.handleDrag.originalPoints, type: "text" },
          point
        );
        this.scene.updateObject(this.handleDrag.objectId, (obj) => ({
          ...obj,
          style: { ...obj.style, rotation: deg },
        }));
      } else {
        this.scene.updateObject(this.handleDrag.objectId, (obj) => ({
          ...obj,
          points: applyHandleDrag(
            obj,
            this.handleDrag.handleId,
            point,
            this.handleDrag.originalPoints,
            this.handleDrag.penOriginalBox,
            {
              shift: event.shiftKey,
              aspect: this.getViewer()?.getMapAspect() || 1,
            }
          ),
        }));
      }
      this.refresh();
      return;
    }

    if (this.objectDrag) {
      event.stopPropagation();
      const point = this.mapPoint(event);
      const dx = point.x - this.objectDrag.startPoint.x;
      const dy = point.y - this.objectDrag.startPoint.y;
      if ((dx !== 0 || dy !== 0) && !this.objectDrag.undoPushed) {
        this.scene.pushUndo();
        this.objectDrag.undoPushed = true;
      }
      if (!this.objectDrag.undoPushed) return;
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
      return;
    }

    if (this.strokeChain) {
      const point = this.mapPoint(event);
      if (point) {
        event.stopPropagation();
        this.updateStrokeChainPreview(point, event.shiftKey);
      }
      return;
    }

    if (this.isHllGarrisonRadiusCheckActive()) {
      const point = this.mapPoint(event);
      if (point) this.updateHllPlacementPreview(point);
      else this.clearHllPlacementPreview();
    } else if (this.hllPlacementPreview) {
      this.clearHllPlacementPreview();
    }
  }

  onPointerUp(event) {
    if (this.handleDrag || this.objectDrag) {
      const drag = this.handleDrag || this.objectDrag;
      const current = this.scene.getObjects().find((o) => o.id === drag.objectId);
      const pointsMoved =
        current &&
        drag.originalPoints &&
        JSON.stringify(current.points) !== JSON.stringify(drag.originalPoints);
      const rotationMoved =
        drag.handleId === "rotate" &&
        current &&
        (Number(current.style?.rotation) || 0) !== (Number(drag.originalRotation) || 0);
      this.handleDrag = null;
      this.objectDrag = null;
      if (pointsMoved || rotationMoved) this.scene.emitChange({ reason: "drag-end" });
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
      if (preview.type === "curve" && preview.points.length >= 4) {
        const a = preview.points[0];
        const b = preview.points[3];
        if (a && b && Math.hypot(b.x - a.x, b.y - a.y) < 0.15) {
          this.refresh();
          return;
        }
      } else if (preview.type === "text") {
        let points = preview.points;
        const [a, b] = points || [];
        if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) < 0.15) {
          points = textBoxFromCenter(session.start, preview.style);
        }
        if (!points?.length) {
          this.refresh();
          return;
        }
        const object = createStratObject("text", {
          points,
          style: preview.style,
          meta: { text: "" },
        });
        this.scene.addObject(object);
        this.maybeSelectAfterCreate(object.id);
        this.refresh();
        this.beginTextEdit?.(object, { selectAll: false });
        return;
      } else if (preview.type !== "pen") {
        const [a, b] = preview.points;
        if (a && b && Math.hypot(b.x - a.x, b.y - a.y) < 0.15) {
          this.refresh();
          return;
        }
      }
      this.scene.addObject(preview);
      this.maybeSelectAfterCreate(preview.id);
    }
    this.refresh();
  }

  onDblClick(event) {
    if (this.locked) return;
    const point = this.mapPoint(event);
    const hit = this.scene.findTopAt(point, hitTestObject);
    if (hit?.type === "text") {
      event.stopPropagation();
      event.preventDefault();
      this.scene.setSelectedId(hit.id);
      this.refresh();
      this.beginTextEdit?.(hit, { selectAll: true });
    }
  }

  onKeyDown(event) {
    if (this.locked) return;
    const target = event.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }

    if (event.key === "Escape") {
      if (this.strokeChain || this.drawSession) {
        event.preventDefault();
        this.cancelStrokeChain();
        if (this.drawSession) {
          this.drawSession = null;
          this.renderer.setPreview(null);
          this.getViewer()?.setBlockPan(this.shouldBlockPan());
          this.refresh();
        }
        return;
      }
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
    this.maybeSelectAfterCreate(copy.id);
    this.refresh();
  }

  updateSelectedStyle(partial) {
    const selected = this.scene.getSelected();
    if (!selected) return;
    this.scene.updateObject(
      selected.id,
      (obj) => ({
        ...obj,
        ...(partial.type ? { type: partial.type } : {}),
        ...(partial.points ? { points: partial.points } : {}),
        style: partial.style ? { ...obj.style, ...partial.style } : obj.style,
        meta: partial.meta ? { ...obj.meta, ...partial.meta } : obj.meta,
      }),
      { pushUndo: true }
    );
    this.refresh();
  }

  setSelectedBezier(enabled) {
    const selected = this.scene.getSelected();
    if (!selected || !["line", "curve", "arrow"].includes(selected.type)) return;

    if (enabled && selected.type !== "curve") {
      const a = selected.points?.[0];
      const b = selected.points?.[selected.points.length - 1];
      if (!a || !b) return;
      this.scene.updateObject(
        selected.id,
        (obj) => ({
          ...obj,
          type: "curve",
          points: cubicPointsFromEndpoints(a, b),
        }),
        { pushUndo: true }
      );
    } else if (!enabled && selected.type === "curve") {
      const p0 = selected.points?.[0];
      const p1 = selected.points?.[selected.points.length - 1];
      if (!p0 || !p1) return;
      this.scene.updateObject(
        selected.id,
        (obj) => ({
          ...obj,
          type: "line",
          points: [p0, p1],
        }),
        { pushUndo: true }
      );
    } else {
      return;
    }
    this.refresh();
  }
}
