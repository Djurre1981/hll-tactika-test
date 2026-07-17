import { ICON_GLYPHS, getObjectBounds } from "./object-schema.js";

/** Canvas 2D renderer — scene uses map-% in a 100×100 logical space. */
export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.mapSize = 1920;
    this.preview = null;
    this.selectedId = null;
    this._raf = 0;
    this._dirty = true;
  }

  setMapSize(size) {
    this.mapSize = size || 1920;
    this.resize();
  }

  resize() {
    const size = this.mapSize;
    if (this.canvas.width !== size || this.canvas.height !== size) {
      this.canvas.width = size;
      this.canvas.height = size;
      this.canvas.style.width = `${size}px`;
      this.canvas.style.height = `${size}px`;
    }
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

  requestDraw(objects) {
    if (objects) this._objects = objects;
    this._dirty = true;
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      if (!this._dirty) return;
      this._dirty = false;
      this.draw(this._objects || []);
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
      const [p] = points;
      const glyph = ICON_GLYPHS[meta?.iconId] || "•";
      const fontPx = Math.max(14, style.size * 0.35 * (this.mapSize / 100));
      ctx.font = `${fontPx}px sans-serif`;
      ctx.fillStyle = style.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(glyph, this.pctToPx(p.x), this.pctToPx(p.y));
      if (meta?.iconLabel) {
        ctx.font = `${fontPx * 0.45}px sans-serif`;
        ctx.fillText(meta.iconLabel, this.pctToPx(p.x), this.pctToPx(p.y) + fontPx * 0.7);
      }
    } else if (type === "ping") {
      const [p] = points;
      const r = Math.max(4, style.size * 0.2 * (this.mapSize / 100));
      ctx.beginPath();
      ctx.arc(this.pctToPx(p.x), this.pctToPx(p.y), r, 0, Math.PI * 2);
      ctx.fillStyle = style.color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff";
      ctx.setLineDash([]);
      ctx.stroke();
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

  draw(objects) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const object of objects) {
      this.drawObject(ctx, object);
    }
    if (this.preview) {
      this.drawObject(ctx, this.preview);
    }
    if (this.selectedId) {
      const selected = objects.find((o) => o.id === this.selectedId);
      if (selected) this.drawSelection(ctx, selected);
    }
  }
}
