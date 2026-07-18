import { getObjectBounds, objectNeedsAnimation } from "./object-schema.js";
import { resolveIconDef } from "./icons/resolve-icon.js";
import { resolveHllAsset } from "./icons/hll-object-catalog.js";

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
    this.preview = null;
    this.selectedId = null;
    this._getObjects = typeof options.getObjects === "function" ? options.getObjects : null;
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
    ctx.strokeStyle = style.color;
    ctx.lineWidth = Math.max(1, style.size * 0.12 * (this.mapSize / 100));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (style.lineType === "dashed") {
      ctx.setLineDash([ctx.lineWidth * 3, ctx.lineWidth * 2]);
    } else if (style.lineType === "dotted") {
      ctx.setLineDash([ctx.lineWidth, ctx.lineWidth * 1.5]);
    } else {
      ctx.setLineDash([]);
    }
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

  drawArrowHead(ctx, from, to, style, atStart) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const px = -uy;
    const py = ux;
    const tip = atStart ? from : to;
    const base = atStart
      ? { x: from.x + ux * 1.2, y: from.y + uy * 1.2 }
      : { x: to.x - ux * 1.2, y: to.y - uy * 1.2 };
    const headSize = Math.max(0.45, style.size * 0.18);
    ctx.beginPath();
    ctx.moveTo(this.pctToPx(tip.x), this.pctToPx(tip.y));
    ctx.lineTo(
      this.pctToPx(base.x + px * headSize),
      this.pctToPx(base.y + py * headSize)
    );
    ctx.lineTo(
      this.pctToPx(base.x - px * headSize),
      this.pctToPx(base.y - py * headSize)
    );
    ctx.closePath();
    ctx.fillStyle = style.color;
    ctx.fill();
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
    const asset = resolveHllAsset(object.meta || {});
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
      ctx.drawImage(img, left, top, widthPx, heightPx);
      return;
    }

    // Placeholder while the PNG loads.
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = Math.max(1, this.mapSize * 0.001);
    ctx.strokeRect(left, top, widthPx, heightPx);
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
      ctx.beginPath();
      ctx.moveTo(this.pctToPx(a.x), this.pctToPx(a.y));
      ctx.lineTo(this.pctToPx(b.x), this.pctToPx(b.y));
      ctx.stroke();
      if (type === "arrow") {
        ctx.setLineDash([]);
        if (style.endType === "end" || style.endType === "none") {
          this.drawArrowHead(ctx, a, b, style, false);
        }
        if (style.endType === "start") {
          this.drawArrowHead(ctx, a, b, style, true);
        }
      }
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
      const [p] = points;
      const fontPx = style.fontSize * 0.22 * (this.mapSize / 100);
      const weight = style.textStyle === 2 ? "700" : "400";
      const italic = style.textStyle === 1 ? "italic " : "";
      ctx.font = `${italic}${weight} ${fontPx}px sans-serif`;
      ctx.fillStyle = style.color;
      ctx.textAlign = style.textAlign || "center";
      ctx.textBaseline = "middle";
      ctx.fillText(meta?.text || "Text", this.pctToPx(p.x), this.pctToPx(p.y));
    } else if (type === "icon") {
      this.drawIcon(ctx, object);
    } else if (type === "hll") {
      this.drawHll(ctx, object);
    } else if (type === "ping") {
      this.drawPing(ctx, object);
    }

    ctx.restore();
  }

  drawSelection(ctx, object) {
    const bounds = getObjectBounds(object);
    if (!bounds) return;
    const x = this.pctToPx(bounds.x);
    const y = this.pctToPx(bounds.y);
    const w = this.pctToPx(bounds.w);
    const h = this.pctToPx(bounds.h);
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff";
    const handles = [
      [x, y],
      [x + w / 2, y],
      [x + w, y],
      [x + w, y + h / 2],
      [x + w, y + h],
      [x + w / 2, y + h],
      [x, y + h],
      [x, y + h / 2],
    ];
    const r = 4;
    for (const [hx, hy] of handles) {
      ctx.fillRect(hx - r, hy - r, r * 2, r * 2);
    }
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
