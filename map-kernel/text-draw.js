/** Draw styled text objects into a canvas context (map-% → px via helpers). */

import {
  buildCanvasFont,
  isOutlineNone,
  shadowOffsetPct,
} from "./text-style.js";

function boxFromPoints(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x1 = Math.min(...xs);
  const y1 = Math.min(...ys);
  const x2 = Math.max(...xs);
  const y2 = Math.max(...ys);
  return {
    x1,
    y1,
    x2,
    y2,
    cx: (x1 + x2) / 2,
    cy: (y1 + y2) / 2,
    w: Math.max(0.5, x2 - x1),
    h: Math.max(0.5, y2 - y1),
  };
}

function alignX(align, left, width, textW) {
  if (align === "left") return left;
  if (align === "right") return left + width - textW;
  return left + (width - textW) / 2;
}

function alignY(valign, top, height, textH) {
  if (valign === "top") return top + textH * 0.8;
  if (valign === "bottom") return top + height - textH * 0.2;
  return top + height / 2;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} object
 * @param {{ pctToPx: (n:number)=>number, mapSize: number }} helpers
 */
export function drawTextObject(ctx, object, helpers) {
  const { points, style, meta } = object;
  if (!points?.length) return;

  const box = boxFromPoints(points);
  const fontPx = Math.max(4, (style.fontSize || 10) * 0.22 * (helpers.mapSize / 100));
  const padPx = Math.max(0, (Number(style.padding) || 0) * 0.22 * (helpers.mapSize / 100));
  const alpha = (Number.isFinite(Number(style.opacity)) ? Number(style.opacity) : 100) / 100;
  const isDraft = Boolean(meta?.draft);
  const text = isDraft ? "add text here" : meta?.text || "Text";

  const cx = helpers.pctToPx(box.cx);
  const cy = helpers.pctToPx(box.cy);
  const wPx = helpers.pctToPx(box.w);
  const hPx = helpers.pctToPx(box.h);
  const rot = ((Number(style.rotation) || 0) * Math.PI) / 180;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  if (isDraft) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.fillRect(-wPx / 2, -hPx / 2, wPx, hPx);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = Math.max(1, helpers.mapSize * 0.0008);
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(-wPx / 2, -hPx / 2, wPx, hPx);
    ctx.setLineDash([]);
  }

  ctx.globalAlpha = alpha;
  ctx.font = buildCanvasFont(
    isDraft ? { ...style, italic: true, bold: false } : style,
    fontPx
  );
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const textH = fontPx;
  const innerL = -wPx / 2 + padPx;
  const innerT = -hPx / 2 + padPx;
  const innerW = Math.max(1, wPx - padPx * 2);
  const innerH = Math.max(1, hPx - padPx * 2);
  const tx = alignX(style.textAlign || "center", innerL, innerW, textW);
  const ty = alignY(style.textVAlign || "middle", innerT, innerH, textH);

  if (isDraft) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.fillText(text, tx, ty);
    ctx.restore();
    return;
  }

  const shadow = shadowOffsetPct(style.shadow, style.fontSize);
  const sx = helpers.pctToPx(shadow.x);
  const sy = helpers.pctToPx(shadow.y);

  const paint = (ox, oy, fillStyle, strokeStyle, strokeW) => {
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fillText(text, tx + ox, ty + oy);
    }
    if (strokeStyle && strokeW > 0) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = strokeW;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeText(text, tx + ox, ty + oy);
    }
  };

  if (style.shadow && style.shadow !== "none") {
    paint(sx, sy, "rgba(0,0,0,0.45)", null, 0);
  }

  const outlineW =
    !isOutlineNone(style.outlineColor) && style.outlineWidth > 0
      ? Math.max(1, style.outlineWidth * 0.12 * (helpers.mapSize / 100))
      : 0;
  if (outlineW) {
    paint(0, 0, null, style.outlineColor, outlineW);
  }
  paint(0, 0, style.color || "#ffffff", null, 0);

  if (style.underline) {
    ctx.strokeStyle = style.color || "#ffffff";
    ctx.lineWidth = Math.max(1, fontPx * 0.08);
    ctx.beginPath();
    ctx.moveTo(tx, ty + fontPx * 0.15);
    ctx.lineTo(tx + textW, ty + fontPx * 0.15);
    ctx.stroke();
  }

  ctx.restore();
}
