/** Line/curve cap + dash helpers — shared by schema, canvas, and UI. */

export const LINE_CAP_TYPES = [
  "none",
  "arrow",
  "arrowMd",
  "arrowSm",
  "chevron",
  "butt",
  "round",
  "circle",
  "square",
  "diamond",
  "tee",
];

export const LINE_DASH_TYPES = [
  "solid",
  "dashed",
  "dotted",
  "dashDot",
  "dashDotDot",
];

/** Caps shown in StratSketch-style pulldowns (visual previews). */
export const LINE_CAP_OPTIONS = [
  { value: "arrow", title: "Arrow large" },
  { value: "arrowMd", title: "Arrow medium" },
  { value: "arrowSm", title: "Arrow small" },
  { value: "chevron", title: "Chevron" },
  { value: "butt", title: "Butt" },
  { value: "round", title: "Round" },
  { value: "circle", title: "Circle" },
  { value: "square", title: "Square" },
  { value: "diamond", title: "Diamond" },
  { value: "tee", title: "T-bar" },
];

export const LINE_DASH_OPTIONS = [
  { value: "solid", title: "Solid" },
  { value: "dashed", title: "Dashed" },
  { value: "dotted", title: "Dotted" },
  { value: "dashDot", title: "Dash-dot" },
  { value: "dashDotDot", title: "Dash-dot-dot" },
];

export function capsFromEndType(endType) {
  switch (endType) {
    case "start":
      return { startCap: "arrow", endCap: "none" };
    case "end":
      return { startCap: "none", endCap: "arrow" };
    case "both":
      return { startCap: "arrow", endCap: "arrow" };
    default:
      return { startCap: "none", endCap: "none" };
  }
}

export function endTypeFromCaps(startCap, endCap) {
  const s = startCap && startCap !== "none";
  const e = endCap && endCap !== "none";
  if (s && e) return "both";
  if (s) return "start";
  if (e) return "end";
  return "none";
}

export function normalizeLineCaps(style = {}) {
  let startCap = LINE_CAP_TYPES.includes(style.startCap) ? style.startCap : null;
  let endCap = LINE_CAP_TYPES.includes(style.endCap) ? style.endCap : null;
  if (!startCap || !endCap) {
    const fromLegacy = capsFromEndType(style.endType || "none");
    startCap = startCap || fromLegacy.startCap;
    endCap = endCap || fromLegacy.endCap;
  }
  return { startCap, endCap };
}

/** Arrow triangle scale factors relative to headSize. */
export function arrowScaleForCap(cap) {
  switch (cap) {
    case "arrow":
      return { length: 1.55, width: 1.15 };
    case "arrowMd":
      return { length: 1.35, width: 0.95 };
    case "arrowSm":
      return { length: 1.1, width: 0.72 };
    default:
      return { length: 1.35, width: 0.95 };
  }
}

/**
 * Cap geometry size in map-%. Scales with stroke width so heads track the shaft;
 * start/end size acts as a relative multiplier (baseline 5).
 */
export function capHeadSize(strokeWidth, capSize = 5) {
  const stroke = Math.max(1, Number(strokeWidth) || 3);
  const cap = Math.max(1, Number(capSize) || 5);
  return Math.max(0.35, stroke * 0.22 * (cap / 5));
}

/**
 * Axial extent of a cap from its reference point (map-%).
 * For arrows: tip → base. For circle/square/diamond: center → outer vertex.
 */
export function capAxisExtent(cap, strokeWidth, capSize) {
  if (!cap || cap === "none") return 0;
  const headSize = capHeadSize(strokeWidth, capSize);
  switch (cap) {
    case "arrow":
    case "arrowMd":
    case "arrowSm":
      return headSize * arrowScaleForCap(cap).length;
    case "chevron":
      return headSize * 1.2;
    case "butt":
      return headSize * 0.85;
    case "circle":
    case "square":
    case "diamond":
    case "round":
      return headSize * 0.7;
    case "tee":
      return 0;
    default:
      return 0;
  }
}

/**
 * How far (map-%) to pull the stroked endpoint back from the handle so the
 * marker fully covers the shaft (no line visible inside the cap).
 */
export function capStrokeInset(cap, strokeWidth, capSize) {
  if (!cap || cap === "none") return 0;
  const extent = capAxisExtent(cap, strokeWidth, capSize);
  switch (cap) {
    case "arrow":
    case "arrowMd":
    case "arrowSm":
    case "butt":
      // Tip at handle; shaft ends at the base / back edge.
      return extent;
    case "chevron":
      return extent * 0.2;
    case "circle":
    case "square":
    case "diamond":
      // Outer tip at handle, center inset by extent → shaft stops at inner edge (2×).
      return extent * 2;
    case "round":
      // Half-disk sits on the tip; shaft ends at the flat diameter.
      return extent;
    case "tee":
    default:
      return 0;
  }
}

/** Move `from` toward `to` by `dist` (clamped so the segment does not collapse). */
export function movePointToward(from, to, dist) {
  if (!from || !to || !(dist > 0)) return from;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  // Allow each end to take up to ~48% so both caps can clear on short lines.
  const t = Math.min(dist, len * 0.48) / len;
  return { x: from.x + dx * t, y: from.y + dy * t };
}

/**
 * Draw a line cap at `to`, oriented along from→to.
 * Handle/`to` is the outer tip. Markers are placed so the shaft can end
 * flush at their inner edge without showing through.
 */
export function paintLineCap(ctx, from, to, cap, strokeWidth, capSize, color, pctToPx = (v) => v) {
  if (!cap || cap === "none") return;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;
  const tip = to;
  const headSize = capHeadSize(strokeWidth, capSize);
  const extent = capAxisExtent(cap, strokeWidth, capSize);
  const pxScale = Math.abs(pctToPx(1) - pctToPx(0)) || 1;
  // Half stroke width in map-% — keep arrow bases at least this wide.
  const halfStrokeMap = Math.max(0.15, (Number(strokeWidth) || 3) * 0.06);

  ctx.setLineDash?.([]);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (cap === "arrow" || cap === "arrowMd" || cap === "arrowSm") {
    const { length: lenK, width: widK } = arrowScaleForCap(cap);
    const base = {
      x: tip.x - ux * headSize * lenK,
      y: tip.y - uy * headSize * lenK,
    };
    const w = Math.max(headSize * widK, halfStrokeMap * 1.25);
    ctx.beginPath();
    ctx.moveTo(pctToPx(tip.x), pctToPx(tip.y));
    ctx.lineTo(pctToPx(base.x + px * w), pctToPx(base.y + py * w));
    ctx.lineTo(pctToPx(base.x - px * w), pctToPx(base.y - py * w));
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (cap === "chevron") {
    const len = headSize * 1.2;
    const w = Math.max(headSize * 0.85, halfStrokeMap * 1.2);
    const wing = { x: tip.x - ux * len, y: tip.y - uy * len };
    ctx.lineWidth = Math.max(1.5, headSize * 0.28 * pxScale);
    ctx.beginPath();
    ctx.moveTo(pctToPx(wing.x + px * w), pctToPx(wing.y + py * w));
    ctx.lineTo(pctToPx(tip.x), pctToPx(tip.y));
    ctx.lineTo(pctToPx(wing.x - px * w), pctToPx(wing.y - py * w));
    ctx.stroke();
    return;
  }

  if (cap === "butt") {
    const half = Math.max(headSize * 0.55, halfStrokeMap);
    const depth = headSize * 0.85;
    const back = { x: tip.x - ux * depth, y: tip.y - uy * depth };
    ctx.beginPath();
    ctx.moveTo(pctToPx(tip.x + px * half), pctToPx(tip.y + py * half));
    ctx.lineTo(pctToPx(tip.x - px * half), pctToPx(tip.y - py * half));
    ctx.lineTo(pctToPx(back.x - px * half), pctToPx(back.y - py * half));
    ctx.lineTo(pctToPx(back.x + px * half), pctToPx(back.y + py * half));
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (cap === "round") {
    // Flat diameter at tip - extent (shaft join); dome faces outward to tip.
    const center = { x: tip.x - ux * extent, y: tip.y - uy * extent };
    const cx = pctToPx(center.x);
    const cy = pctToPx(center.y);
    const r = Math.max(2, extent * pxScale);
    const ang = Math.atan2(uy, ux);
    ctx.beginPath();
    ctx.arc(cx, cy, r, ang - Math.PI / 2, ang + Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (cap === "circle" || cap === "square" || cap === "diamond") {
    // Outer tip at handle; center pulled back so the shaft meets the inner edge.
    const center = { x: tip.x - ux * extent, y: tip.y - uy * extent };
    const cx = pctToPx(center.x);
    const cy = pctToPx(center.y);
    const r = Math.max(2, extent * pxScale);

    if (cap === "circle") {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (cap === "square") {
      // Orient square with edges perpendicular to the shaft.
      const h = extent;
      ctx.beginPath();
      ctx.moveTo(pctToPx(center.x + ux * h + px * h), pctToPx(center.y + uy * h + py * h));
      ctx.lineTo(pctToPx(center.x + ux * h - px * h), pctToPx(center.y + uy * h - py * h));
      ctx.lineTo(pctToPx(center.x - ux * h - px * h), pctToPx(center.y - uy * h - py * h));
      ctx.lineTo(pctToPx(center.x - ux * h + px * h), pctToPx(center.y - uy * h + py * h));
      ctx.closePath();
      ctx.fill();
      return;
    }

    // Diamond: outer tip at `tip`, inner tip toward the shaft.
    ctx.beginPath();
    ctx.moveTo(pctToPx(tip.x), pctToPx(tip.y));
    ctx.lineTo(pctToPx(center.x + px * extent), pctToPx(center.y + py * extent));
    ctx.lineTo(pctToPx(center.x - ux * extent), pctToPx(center.y - uy * extent));
    ctx.lineTo(pctToPx(center.x - px * extent), pctToPx(center.y - py * extent));
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (cap === "tee") {
    const half = Math.max(headSize * 0.9, halfStrokeMap * 1.4);
    ctx.lineWidth = Math.max(2, headSize * 0.28 * pxScale);
    ctx.beginPath();
    ctx.moveTo(pctToPx(tip.x + px * half), pctToPx(tip.y + py * half));
    ctx.lineTo(pctToPx(tip.x - px * half), pctToPx(tip.y - py * half));
    ctx.stroke();
  }
}

/** Canvas lineDash pattern for a given lineType. */
export function lineDashForType(lineType, lineWidth) {
  const w = Math.max(1, lineWidth);
  switch (lineType) {
    case "dashed":
      return [w * 3, w * 2];
    case "dotted":
      return [w, w * 1.5];
    case "dashDot":
      return [w * 3, w * 1.6, w, w * 1.6];
    case "dashDotDot":
      return [w * 3, w * 1.5, w, w * 1.5, w, w * 1.5];
    default:
      return [];
  }
}
