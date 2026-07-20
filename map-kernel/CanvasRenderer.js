import { getObjectBounds, objectNeedsAnimation } from "./object-schema.js";
import { resolveIconDef } from "./icons/resolve-icon.js";
import { resolveHllAsset } from "./icons/hll-object-catalog.js";
import { curveHandleDrawSizes } from "./selection-handles.js";
import { lineDashForType, paintLineCap, capStrokeInset, movePointToward, normalizeLineCaps } from "./line-caps.js";
import { drawTextObject } from "./text-draw.js";

/** Match legacy CSS: strat-ping-pulse 1.2s ease-out infinite, delay ring*0.35s */
const PING_PERIOD_MS = 1200;
const PING_STAGGER_MS = 350;
const PING_SCALE_FROM = 0.85;
const PING_SCALE_TO = 1.8;
const PING_OPACITY_FROM = 0.85;
/** Pulse does not need 60fps; cap to reduce GPU/main-thread load on large maps. */
const ANIM_MIN_FRAME_MS = 1000 / 30;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

/** Positive fractional progress in [0, 1). */
function pingProgress(nowMs, ring) {
  const phase = (nowMs - ring * PING_STAGGER_MS) / PING_PERIOD_MS;
  return ((phase % 1) + 1) % 1;
}

function sizeCanvas(canvas, size) {
  if (!canvas) return;
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  if (canvas.style) {
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
  }
}

/**
 * Canvas 2D renderer — scene uses map-% in a 100×100 logical space.
 *
 * Static objects paint to the main canvas (dirty-only). Animated types
 * (see ANIMATED_OBJECT_TYPES) paint to a stacked anim canvas at ~30fps.
 */
export class CanvasRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.animCanvas = options.animCanvas || null;
    this.animCtx = this.animCanvas ? this.animCanvas.getContext("2d") : null;
    this.mapSize = 1920;
    this.viewScale = 1;
    this.preview = null;
    this.selectedId = null;
    this.editingTextId = null;
    this._getObjects = typeof options.getObjects === "function" ? options.getObjects : null;
    this._getToolSettings =
      typeof options.getToolSettings === "function" ? options.getToolSettings : null;
    this._raf = 0;
    this._animRaf = 0;
    this._animRunning = false;
    this._animPausedByVisibility = false;
    this._lastAnimDrawMs = 0;
    this._dirty = true;
    this._staticDirty = true;
    this._objects = [];
    this._pathCache = new Map();
    this._imageCache = new Map();
    this._onVisibilityChange = () => this._handleVisibilityChange();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this._onVisibilityChange);
    }
  }

  setMapSize(size) {
    this.mapSize = size || 1920;
    this.resize();
  }

  /** Viewer CSS scale — keeps curve edit handles constant on screen. */
  setViewScale(scale) {
    const next = Math.max(0.08, Number(scale) || 1);
    if (Math.abs(next - this.viewScale) < 0.0005) return;
    this.viewScale = next;
    this._staticDirty = true;
    this.requestDraw();
  }

  resize() {
    const size = this.mapSize;
    sizeCanvas(this.canvas, size);
    sizeCanvas(this.animCanvas, size);
    this._staticDirty = true;
    this.requestDraw();
  }

  setPreview(object) {
    this.preview = object;
    this.requestDraw();
  }

  setSelectedId(id) {
    this.selectedId = id || null;
    this.requestDraw();
  }

  setEditingTextId(id) {
    this.editingTextId = id || null;
    this.requestDraw();
  }

  destroy() {
    if (typeof document !== "undefined" && this._onVisibilityChange) {
      document.removeEventListener("visibilitychange", this._onVisibilityChange);
    }
    this._onVisibilityChange = null;
    this.stopAnimationLoop({ clearAnim: true });
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
  }

  resolveObjects(objects) {
    if (Array.isArray(objects)) {
      this._objects = objects;
      return objects;
    }
    if (this._getObjects) {
      try {
        const latest = this._getObjects();
        if (Array.isArray(latest)) {
          this._objects = latest;
          return latest;
        }
      } catch {
        // keep last known objects
      }
    }
    return this._objects || [];
  }

  needsAnimation(objects) {
    const list = Array.isArray(objects) ? objects : this._objects || [];
    if (list.some(objectNeedsAnimation)) return true;
    return objectNeedsAnimation(this.preview);
  }

  _isDocumentHidden() {
    return typeof document !== "undefined" && document.visibilityState === "hidden";
  }

  _handleVisibilityChange() {
    if (this._isDocumentHidden()) {
      if (this._animRunning) {
        this._animPausedByVisibility = true;
        this.stopAnimationLoop({ clearAnim: false });
      }
      return;
    }
    if (this._animPausedByVisibility || this.needsAnimation()) {
      this._animPausedByVisibility = false;
      this.syncAnimationLoop(this.resolveObjects());
    }
  }

  clearAnimLayer() {
    if (!this.animCtx || !this.animCanvas) return;
    this.animCtx.clearRect(0, 0, this.animCanvas.width, this.animCanvas.height);
  }

  startAnimationLoop() {
    if (this._animRunning) return;
    if (this._isDocumentHidden()) {
      this._animPausedByVisibility = true;
      return;
    }
    this._animRunning = true;
    this._animPausedByVisibility = false;
    this._lastAnimDrawMs = 0;

    // Avoid racing a one-shot draw that could freeze on a single frame.
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }

    const tick = (now) => {
      if (!this._animRunning) return;
      this._animRaf = requestAnimationFrame(tick);

      const t = typeof now === "number" ? now : performance.now();
      if (t - this._lastAnimDrawMs < ANIM_MIN_FRAME_MS) return;
      this._lastAnimDrawMs = t;

      const objects = this.resolveObjects();
      if (this.animCtx) {
        if (this._staticDirty) {
          this.drawStatic(objects);
          this._staticDirty = false;
          this._dirty = false;
        }
        this.drawAnimated(objects);
      } else {
        // No overlay canvas: full redraw (legacy cost). Prefer passing animCanvas.
        this.drawStatic(objects);
        this._paintAnimatedOnto(this.ctx, objects);
        this._staticDirty = false;
        this._dirty = false;
      }

      if (!this.needsAnimation(objects)) {
        this.stopAnimationLoop({ clearAnim: true });
      }
    };
    this._animRaf = requestAnimationFrame(tick);
  }

  stopAnimationLoop({ clearAnim = true } = {}) {
    this._animRunning = false;
    if (this._animRaf) {
      cancelAnimationFrame(this._animRaf);
      this._animRaf = 0;
    }
    if (clearAnim) this.clearAnimLayer();
  }

  syncAnimationLoop(objects) {
    if (this.needsAnimation(objects)) {
      this.startAnimationLoop();
    } else {
      this._animPausedByVisibility = false;
      this.stopAnimationLoop({ clearAnim: true });
    }
  }

  requestDraw(objects) {
    const list = this.resolveObjects(objects);
    this._staticDirty = true;
    this._dirty = true;
    this.syncAnimationLoop(list);
    if (this._animRunning) return;
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      if (!this._dirty || this._animRunning) return;
      this._dirty = false;
      this._staticDirty = false;
      this.drawStatic(this.resolveObjects());
      this.clearAnimLayer();
    });
  }

  pctToPx(p) {
    return (p / 100) * this.mapSize;
  }

  strokeStyle(ctx, style) {
    const opacity = Number.isFinite(Number(style.opacity)) ? Number(style.opacity) : 100;
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity / 100));
    ctx.strokeStyle = style.color;
    ctx.fillStyle = style.color;
    ctx.lineWidth = Math.max(1, style.size * 0.12 * (this.mapSize / 100));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(lineDashForType(style.lineType, ctx.lineWidth));
  }

  resolveCaps(style, type) {
    // Normalize each side independently so a set startCap can't leave endCap as none.
    const caps = normalizeLineCaps(style || {});
    let startCap = caps.startCap;
    let endCap = caps.endCap;
    if (type === "arrow" && (!endCap || endCap === "none")) endCap = "arrow";
    return { startCap, endCap };
  }

  drawLineCap(ctx, from, to, style, atStart) {
    const caps = this.resolveCaps(style);
    const cap = atStart ? caps.startCap : caps.endCap;
    if (!cap || cap === "none") return;
    const capSize = Number(atStart ? style.startSize : style.endSize) || 5;
    // paintLineCap always draws at `to`; flip endpoints for start caps.
    const a = atStart ? to : from;
    const b = atStart ? from : to;
    paintLineCap(ctx, a, b, cap, style.size, capSize, style.color, (p) => this.pctToPx(p));
  }

  drawArrowHead(ctx, from, to, style, atStart) {
    this.drawLineCap(ctx, from, to, { ...style, startCap: "arrow", endCap: "arrow" }, atStart);
  }

  getCachedPath(pathD) {
    let path = this._pathCache.get(pathD);
    if (!path) {
      try {
        path = new Path2D(pathD);
      } catch {
        path = null;
      }
      if (path) this._pathCache.set(pathD, path);
    }
    return path;
  }

  fillIconLayers(ctx, icon) {
    const layers = icon.layers?.length ? icon.layers : icon.path ? [icon.path] : [];
    if (!layers.length) return;

    if (layers.length === 1) {
      const path = this.getCachedPath(layers[0]);
      if (path) ctx.fill(path);
      return;
    }

    // StratSketch knockout: primary in fill color, extra layers punch holes.
    const w = Math.max(1, icon.width || 512);
    const h = Math.max(1, icon.height || 512);
    if (!this._iconScratch || this._iconScratch.width !== w || this._iconScratch.height !== h) {
      this._iconScratch =
        typeof OffscreenCanvas !== "undefined"
          ? new OffscreenCanvas(w, h)
          : Object.assign(document.createElement("canvas"), { width: w, height: h });
    }
    const sc = this._iconScratch.getContext("2d");
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.clearRect(0, 0, w, h);
    sc.globalCompositeOperation = "source-over";
    sc.fillStyle = typeof ctx.fillStyle === "string" ? ctx.fillStyle : "#ffffff";
    const primary = this.getCachedPath(layers[0]);
    if (primary) sc.fill(primary);
    sc.globalCompositeOperation = "destination-out";
    for (let i = 1; i < layers.length; i += 1) {
      const hole = this.getCachedPath(layers[i]);
      if (hole) sc.fill(hole);
    }
    sc.globalCompositeOperation = "source-over";
    ctx.drawImage(this._iconScratch, 0, 0);
  }

  getCachedImage(src) {
    if (!src) return null;
    let entry = this._imageCache.get(src);
    if (entry) return entry.img?.complete && entry.img.naturalWidth ? entry.img : null;

    entry = { img: null, loading: true };
    this._imageCache.set(src, entry);
    if (typeof Image === "undefined") {
      entry.loading = false;
      return null;
    }
    const img = new Image();
    entry.img = img;
    img.decoding = "async";
    img.onload = () => {
      entry.loading = false;
      this._staticDirty = true;
      this.requestDraw();
    };
    img.onerror = () => {
      entry.loading = false;
    };
    img.src = src;
    return null;
  }

  drawHll(ctx, object) {
    const showRadius = this._getToolSettings?.()?.hllShowRadius !== false;
    const asset = resolveHllAsset(object.meta || {}, { showRadius });
    if (!asset) return;

    let x1;
    let y1;
    let x2;
    let y2;
    const { points } = object;
    if (points.length >= 2) {
      x1 = Math.min(points[0].x, points[1].x);
      y1 = Math.min(points[0].y, points[1].y);
      x2 = Math.max(points[0].x, points[1].x);
      y2 = Math.max(points[0].y, points[1].y);
    } else {
      const [p] = points;
      const halfW = Math.max(0.35, asset.sizeWPct / 2);
      const halfH = Math.max(0.35, asset.sizeHPct / 2);
      x1 = p.x - halfW;
      y1 = p.y - halfH;
      x2 = p.x + halfW;
      y2 = p.y + halfH;
    }

    const left = this.pctToPx(x1);
    const top = this.pctToPx(y1);
    const widthPx = Math.max(1, this.pctToPx(x2 - x1));
    const heightPx = Math.max(1, this.pctToPx(y2 - y1));
    const img = this.getCachedImage(asset.src);
    if (img) {
      if (object.meta?.placementPreview) {
        const tw = Math.max(1, Math.ceil(widthPx));
        const th = Math.max(1, Math.ceil(heightPx));
        if (!this._hllTintCanvas) this._hllTintCanvas = document.createElement("canvas");
        const off = this._hllTintCanvas;
        if (off.width !== tw) off.width = tw;
        if (off.height !== th) off.height = th;
        const octx = off.getContext("2d");
        octx.clearRect(0, 0, tw, th);
        octx.drawImage(img, 0, 0, widthPx, heightPx);
        octx.globalCompositeOperation = "source-atop";
        octx.fillStyle =
          object.meta.placeOk !== false
            ? "rgba(34, 197, 94, 0.45)"
            : "rgba(239, 68, 68, 0.45)";
        octx.fillRect(0, 0, tw, th);
        octx.globalCompositeOperation = "source-over";
        ctx.drawImage(off, left, top);
      } else {
        ctx.drawImage(img, left, top, widthPx, heightPx);
      }
      return;
    }

    // Placeholder while the PNG loads.
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = Math.max(1, this.mapSize * 0.001);
    ctx.strokeRect(left, top, widthPx, heightPx);
    if (object.meta?.placementPreview) {
      ctx.fillStyle =
        object.meta.placeOk !== false
          ? "rgba(34, 197, 94, 0.25)"
          : "rgba(239, 68, 68, 0.25)";
      ctx.fillRect(left, top, widthPx, heightPx);
    }
    ctx.restore();
  }

  drawIcon(ctx, object) {
    const { style, meta, points } = object;
    const icon = resolveIconDef(meta);
    let x1;
    let y1;
    let x2;
    let y2;
    if (points.length >= 2) {
      x1 = Math.min(points[0].x, points[1].x);
      y1 = Math.min(points[0].y, points[1].y);
      x2 = Math.max(points[0].x, points[1].x);
      y2 = Math.max(points[0].y, points[1].y);
    } else {
      const [p] = points;
      const half = Math.max(0.9, style.size * 0.275);
      x1 = p.x - half;
      y1 = p.y - half;
      x2 = p.x + half;
      y2 = p.y + half;
    }

    const left = this.pctToPx(x1);
    const top = this.pctToPx(y1);
    const widthPx = Math.max(1, this.pctToPx(x2 - x1));
    const heightPx = Math.max(1, this.pctToPx(y2 - y1));
    const cx = left + widthPx / 2;
    const cy = top + heightPx / 2;

    if (icon?.path || icon?.layers?.length) {
      const iw = icon.width || 512;
      const ih = icon.height || 512;
      ctx.save();
      ctx.translate(cx, cy);
      // Independent scales so corner/edge handles can stretch like rect/ellipse.
      ctx.scale(widthPx / iw, heightPx / ih);
      ctx.translate(-iw / 2, -ih / 2);
      ctx.fillStyle = style.color;
      this.fillIconLayers(ctx, icon);
      ctx.restore();
    } else {
      const r = Math.min(widthPx, heightPx) * 0.35;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = style.color;
      ctx.fill();
    }

    if (meta?.iconLabel) {
      const fontPx = Math.max(10, Math.min(widthPx, heightPx) * 0.35);
      ctx.font = `${fontPx}px sans-serif`;
      ctx.fillStyle = style.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(meta.iconLabel, cx, top + heightPx + fontPx * 0.15);
    }
  }

  drawPing(ctx, object) {
    const [p] = object.points;
    const { style } = object;
    const cx = this.pctToPx(p.x);
    const cy = this.pctToPx(p.y);
    const strokeW = Math.max(2, style.size * 0.08 * (this.mapSize / 100));
    // Always read wall clock so rings pulse even if a caller forgot to pass rAF time.
    const now = performance.now();

    ctx.setLineDash([]);
    for (let ring = 0; ring < 3; ring += 1) {
      const t = easeOutCubic(pingProgress(now, ring));
      const scale = PING_SCALE_FROM + (PING_SCALE_TO - PING_SCALE_FROM) * t;
      const opacity = PING_OPACITY_FROM * (1 - t);
      const baseRPct = 0.45 + ring * 0.4;
      const radius = this.pctToPx(baseRPct) * scale;

      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, radius), 0, Math.PI * 2);
      ctx.strokeStyle = style.color;
      ctx.lineWidth = strokeW;
      ctx.globalAlpha = opacity;
      ctx.stroke();
    }

    // Small core so the mark stays readable between ring peaks.
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, strokeW * 0.9), 0, Math.PI * 2);
    ctx.fillStyle = style.color;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawObject(ctx, object) {
    const { type, points, style, meta } = object;
    if (!points?.length) return;
    if (type === "text" && object.id && object.id === this.editingTextId) return;

    ctx.save();
    this.strokeStyle(ctx, style);

    if (type === "pen") {
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = this.pctToPx(p.x);
        const y = this.pctToPx(p.y);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (style.filled && points.length >= 3) {
        ctx.closePath();
        ctx.fillStyle = style.color;
        ctx.globalAlpha = 0.25;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.stroke();
    } else if (type === "line" || type === "arrow") {
      const [a, b] = points;
      const caps = this.resolveCaps(style, type);
      const startInset = capStrokeInset(caps.startCap, style.size, style.startSize);
      const endInset = capStrokeInset(caps.endCap, style.size, style.endSize);
      const strokeStart = movePointToward(a, b, startInset);
      const strokeEnd = movePointToward(b, a, endInset);
      // Butt caps so the shaft ends flush under the marker (no round nub).
      if (startInset > 0 || endInset > 0) ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(this.pctToPx(strokeStart.x), this.pctToPx(strokeStart.y));
      ctx.lineTo(this.pctToPx(strokeEnd.x), this.pctToPx(strokeEnd.y));
      ctx.stroke();
      if (caps.endCap !== "none") this.drawLineCap(ctx, a, b, { ...style, ...caps }, false);
      if (caps.startCap !== "none") this.drawLineCap(ctx, a, b, { ...style, ...caps }, true);
    } else if (type === "curve" && points.length >= 4) {
      const [p0, cp1, cp2, p1] = points;
      const caps = this.resolveCaps(style, type);
      const startInset = capStrokeInset(caps.startCap, style.size, style.startSize);
      const endInset = capStrokeInset(caps.endCap, style.size, style.endSize);
      // Pull endpoints along end tangents so markers cover the shaft.
      const strokeP0 = movePointToward(p0, cp1, startInset);
      const strokeP1 = movePointToward(p1, cp2, endInset);
      if (startInset > 0 || endInset > 0) ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(this.pctToPx(strokeP0.x), this.pctToPx(strokeP0.y));
      ctx.bezierCurveTo(
        this.pctToPx(cp1.x),
        this.pctToPx(cp1.y),
        this.pctToPx(cp2.x),
        this.pctToPx(cp2.y),
        this.pctToPx(strokeP1.x),
        this.pctToPx(strokeP1.y)
      );
      ctx.stroke();
      if (caps.endCap !== "none") this.drawLineCap(ctx, cp2, p1, { ...style, ...caps }, false);
      if (caps.startCap !== "none") this.drawLineCap(ctx, p0, cp1, { ...style, ...caps }, true);
    } else if (type === "rect") {
      const [a, b] = points;
      const x = this.pctToPx(Math.min(a.x, b.x));
      const y = this.pctToPx(Math.min(a.y, b.y));
      const w = this.pctToPx(Math.abs(b.x - a.x));
      const h = this.pctToPx(Math.abs(b.y - a.y));
      if (style.filled) {
        ctx.fillStyle = style.color;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
      }
      ctx.strokeRect(x, y, w, h);
    } else if (type === "ellipse") {
      const [a, b] = points;
      const cx = this.pctToPx((a.x + b.x) / 2);
      const cy = this.pctToPx((a.y + b.y) / 2);
      const rx = this.pctToPx(Math.abs(b.x - a.x) / 2);
      const ry = this.pctToPx(Math.abs(b.y - a.y) / 2);
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
      if (style.filled) {
        ctx.fillStyle = style.color;
        ctx.globalAlpha = 0.25;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.stroke();
    } else if (type === "text") {
      drawTextObject(ctx, object, {
        pctToPx: (n) => this.pctToPx(n),
        mapSize: this.mapSize,
      });
    } else if (type === "icon") {
      this.drawIcon(ctx, object);
    } else if (type === "hll") {
      this.drawHll(ctx, object);
    } else if (type === "ping") {
      this.drawPing(ctx, object);
    }

    ctx.restore();
  }

  _drawHandleDisc(ctx, p, radius, fill, strokeWidth) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }

  _drawHandleCores(ctx, points, coreRadius) {
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, coreRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.fill();
    }
  }

  drawCurveEditChrome(ctx, object, { dim = false } = {}) {
    if (!object?.points || object.points.length < 4) return;
    const [p0, cp1, cp2, p1] = object.points;
    const toPx = (p) => ({ x: this.pctToPx(p.x), y: this.pctToPx(p.y) });
    const a0 = toPx(p0);
    const a1 = toPx(cp1);
    const b1 = toPx(cp2);
    const b0 = toPx(p1);
    const sizes = curveHandleDrawSizes(this.viewScale);
    const alpha = dim ? 0.55 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Control polygon (Plasticity: gray CV links) — full p0–cp1–cp2–p1.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = sizes.armWidth;
    ctx.setLineDash([Math.max(3, sizes.armWidth * 2.5), Math.max(3, sizes.armWidth * 2)]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a0.x, a0.y);
    ctx.lineTo(a1.x, a1.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.lineTo(b0.x, b0.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Accent arms vertex→CV (clearer influence direction).
    ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
    ctx.lineWidth = sizes.armWidth * 0.85;
    ctx.beginPath();
    ctx.moveTo(a0.x, a0.y);
    ctx.lineTo(a1.x, a1.y);
    ctx.moveTo(b0.x, b0.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.stroke();

    // CVs first (smaller), then vertices on top (Plasticity hierarchy).
    this._drawHandleDisc(ctx, a1, sizes.control, "#ef4444", sizes.stroke);
    this._drawHandleDisc(ctx, b1, sizes.control, "#ef4444", sizes.stroke);
    this._drawHandleDisc(ctx, a0, sizes.endpoint, "#dc2626", sizes.stroke);
    this._drawHandleDisc(ctx, b0, sizes.endpoint, "#dc2626", sizes.stroke);
    this._drawHandleCores(ctx, [a1, b1, a0, b0], Math.max(1.2, sizes.control * 0.28));

    ctx.restore();
  }

  /** Endpoint discs matching curve chrome — straight lines use the same grab affordance. */
  drawLineEditChrome(ctx, object, { dim = false } = {}) {
    if (!object?.points || object.points.length < 2) return;
    const toPx = (p) => ({ x: this.pctToPx(p.x), y: this.pctToPx(p.y) });
    const a = toPx(object.points[0]);
    const b = toPx(object.points[1]);
    const sizes = curveHandleDrawSizes(this.viewScale);

    ctx.save();
    ctx.globalAlpha = dim ? 0.55 : 1;
    this._drawHandleDisc(ctx, a, sizes.endpoint, "#dc2626", sizes.stroke);
    this._drawHandleDisc(ctx, b, sizes.endpoint, "#dc2626", sizes.stroke);
    this._drawHandleCores(ctx, [a, b], Math.max(1.2, sizes.control * 0.28));
    ctx.restore();
  }

  drawSelection(ctx, object) {
    if (object?.id && object.id === this.editingTextId) return;

    if (object?.type === "curve" && object.points?.length >= 4) {
      this.drawCurveEditChrome(ctx, object);
      return;
    }

    if ((object?.type === "line" || object?.type === "arrow") && object.points?.length >= 2) {
      this.drawLineEditChrome(ctx, object);
      return;
    }

    if (object?.type === "text" && object.points?.length >= 2) {
      this.drawTextEditChrome(ctx, object);
      return;
    }

    this.drawBoxEditChrome(ctx, object);
  }

  /** Shared resize chrome: dashed frame + red discs (line/curve style). */
  drawBoxEditChrome(ctx, object) {
    const bounds = getObjectBounds(object);
    if (!bounds) return;
    const sizes = curveHandleDrawSizes(this.viewScale);
    const x = this.pctToPx(bounds.x);
    const y = this.pctToPx(bounds.y);
    const w = this.pctToPx(bounds.w);
    const h = this.pctToPx(bounds.h);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = sizes.armWidth;
    ctx.setLineDash([Math.max(3, sizes.armWidth * 2.5), Math.max(3, sizes.armWidth * 2)]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    const corners = [
      [x, y],
      [x + w / 2, y],
      [x + w, y],
      [x + w, y + h / 2],
      [x + w, y + h],
      [x + w / 2, y + h],
      [x, y + h],
      [x, y + h / 2],
    ];
    for (const [hx, hy] of corners) {
      this._drawHandleDisc(ctx, { x: hx, y: hy }, sizes.endpoint, "#dc2626", sizes.stroke);
    }
    this._drawHandleCores(
      ctx,
      corners.map(([hx, hy]) => ({ x: hx, y: hy })),
      Math.max(1.2, sizes.control * 0.28)
    );
    ctx.restore();
  }

  /** Text box: dashed frame, red discs (line-style), green rotation handle. */
  drawTextEditChrome(ctx, object) {
    this.drawBoxEditChrome(ctx, object);
    const bounds = getObjectBounds(object);
    if (!bounds) return;
    const sizes = curveHandleDrawSizes(this.viewScale);
    const x = this.pctToPx(bounds.x);
    const y = this.pctToPx(bounds.y);
    const w = this.pctToPx(bounds.w);
    const h = this.pctToPx(bounds.h);
    const lift = Math.max(sizes.endpoint * 2.2, h * 0.12 + sizes.endpoint * 1.6);

    ctx.save();
    const rx = x + w / 2;
    const ry = y - lift;
    ctx.strokeStyle = "rgba(74, 222, 128, 0.9)";
    ctx.lineWidth = sizes.armWidth;
    ctx.beginPath();
    ctx.moveTo(rx, y);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    this._drawHandleDisc(ctx, { x: rx, y: ry }, sizes.endpoint, "#22c55e", sizes.stroke);
    this._drawHandleCores(ctx, [{ x: rx, y: ry }], Math.max(1.2, sizes.control * 0.28));
    ctx.restore();
  }

  findSelected(objects) {
    if (!this.selectedId) return null;
    return objects.find((o) => o.id === this.selectedId) || null;
  }

  /** Dirty-only: non-animated scene + static preview/selection. */
  drawStatic(objects) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const object of objects) {
      if (objectNeedsAnimation(object)) continue;
      this.drawObject(ctx, object);
    }
    if (this.preview && !objectNeedsAnimation(this.preview)) {
      this.drawObject(ctx, this.preview);
      if (this.preview.type === "curve") {
        this.drawCurveEditChrome(ctx, this.preview, { dim: true });
      } else if (this.preview.type === "line" || this.preview.type === "arrow") {
        this.drawLineEditChrome(ctx, this.preview, { dim: true });
      }
    }
    const selected = this.findSelected(objects);
    if (selected && !objectNeedsAnimation(selected)) {
      this.drawSelection(ctx, selected);
    }
  }

  _paintAnimatedOnto(ctx, objects) {
    for (const object of objects) {
      if (!objectNeedsAnimation(object)) continue;
      this.drawObject(ctx, object);
    }
    if (this.preview && objectNeedsAnimation(this.preview)) {
      this.drawObject(ctx, this.preview);
    }
    const selected = this.findSelected(objects);
    if (selected && objectNeedsAnimation(selected)) {
      this.drawSelection(ctx, selected);
    }
  }

  /** Per-frame: pings (+ animated preview/selection) on the overlay canvas. */
  drawAnimated(objects) {
    if (!this.animCtx || !this.animCanvas) {
      this._paintAnimatedOnto(this.ctx, objects);
      return;
    }
    this.animCtx.clearRect(0, 0, this.animCanvas.width, this.animCanvas.height);
    this._paintAnimatedOnto(this.animCtx, objects);
  }

  /** Full redraw helper (tests / fallback when no anim layer). */
  draw(objects) {
    this.drawStatic(objects);
    if (this.animCtx) {
      this.drawAnimated(objects);
    } else {
      this._paintAnimatedOnto(this.ctx, objects);
    }
  }
}
