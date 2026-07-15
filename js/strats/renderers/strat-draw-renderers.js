import { STRAT_ICON_OPTIONS } from "../../helpers/strat-defaults.js";
import { getStratSketchIconSync } from "../stratsketch-icons.js";
import ssIconPack from "../stratsketch-icon-pack.js";
import { setStrokeAttributes } from "../strat-draw-render.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const ICON_MAP = Object.fromEntries(STRAT_ICON_OPTIONS.map((option) => [option.id, option.icon]));
const LEGACY_ICON_GLYPHS = {
  check: "✓",
  xmark: "✕",
  "circle-question": "?",
  "circle-info": "i",
  "triangle-exclamation": "!",
  house: "⌂",
  ban: "⊘",
  binoculars: "◎",
  bomb: "✹",
  "car-side": "▣",
  "truck-pickup": "▣",
  "jet-fighter": "▲",
  crosshairs: "+",
  flag: "⚑",
  gun: "╋",
  shield: "⛨",
  "skull-crossbones": "☠",
  "person-rifle": "⚔",
  "map-pin": "📍",
  "location-dot": "•",
};

function appendArrowHead(parent, from, to, style, atStart = false) {
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

  const polygon = document.createElementNS(SVG_NS, "polygon");
  polygon.setAttribute(
    "points",
    `${tip.x},${tip.y} ${base.x + px * headSize},${base.y + py * headSize} ${base.x - px * headSize},${base.y - py * headSize}`
  );
  polygon.setAttribute("fill", style.color);
  polygon.setAttribute("stroke", "none");
  parent.appendChild(polygon);
}

export function renderPen(group, object) {
  const pointsStr = object.points.map((point) => `${point.x},${point.y}`).join(" ");

  if (object.style.filled && object.points.length >= 3) {
    const polygon = document.createElementNS(SVG_NS, "polygon");
    polygon.setAttribute("points", pointsStr);
    polygon.setAttribute("fill", object.style.color);
    polygon.setAttribute("fill-opacity", "0.25");
    setStrokeAttributes(polygon, object.style);
    group.appendChild(polygon);
    return;
  }

  const polyline = document.createElementNS(SVG_NS, "polyline");
  polyline.setAttribute("points", pointsStr);
  polyline.setAttribute("fill", "none");
  setStrokeAttributes(polyline, object.style);
  group.appendChild(polyline);
}

export function renderLine(group, object, { arrow = false } = {}) {
  const [start, end] = object.points;
  const line = document.createElementNS(SVG_NS, "line");
  line.setAttribute("x1", String(start.x));
  line.setAttribute("y1", String(start.y));
  line.setAttribute("x2", String(end.x));
  line.setAttribute("y2", String(end.y));
  line.setAttribute("fill", "none");
  setStrokeAttributes(line, object.style);
  group.appendChild(line);

  if (arrow) {
    if (object.style.endType === "end" || object.style.endType === "none") {
      appendArrowHead(group, start, end, object.style, false);
    }
    if (object.style.endType === "start") {
      appendArrowHead(group, start, end, object.style, true);
    }
  }
}

export function renderRect(group, object) {
  const [a, b] = object.points;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", String(x));
  rect.setAttribute("y", String(y));
  rect.setAttribute("width", String(w));
  rect.setAttribute("height", String(h));
  if (object.style.filled) {
    rect.setAttribute("fill", object.style.color);
    rect.setAttribute("fill-opacity", "0.25");
  } else {
    rect.setAttribute("fill", "none");
  }
  setStrokeAttributes(rect, object.style);
  group.appendChild(rect);
}

export function renderEllipse(group, object) {
  const [a, b] = object.points;
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  const ellipse = document.createElementNS(SVG_NS, "ellipse");
  ellipse.setAttribute("cx", String(cx));
  ellipse.setAttribute("cy", String(cy));
  ellipse.setAttribute("rx", String(rx));
  ellipse.setAttribute("ry", String(ry));
  if (object.style.filled) {
    ellipse.setAttribute("fill", object.style.color);
    ellipse.setAttribute("fill-opacity", "0.25");
  } else {
    ellipse.setAttribute("fill", "none");
  }
  setStrokeAttributes(ellipse, object.style);
  group.appendChild(ellipse);
}

export function renderText(group, object) {
  const [point] = object.points;
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(point.x));
  text.setAttribute("y", String(point.y));
  text.setAttribute("fill", object.style.color);
  text.setAttribute("font-size", String(object.style.fontSize * 0.22));
  text.setAttribute("dominant-baseline", "middle");
  text.textContent = object.meta?.text || "Text";

  if (object.style.textAlign === "center") {
    text.setAttribute("text-anchor", "middle");
  } else if (object.style.textAlign === "right") {
    text.setAttribute("text-anchor", "end");
  } else {
    text.setAttribute("text-anchor", "start");
  }

  if (object.style.textStyle === 1) {
    text.setAttribute("font-weight", "700");
  } else if (object.style.textStyle === 2) {
    text.setAttribute("font-style", "italic");
  }

  group.appendChild(text);
}

function renderStratSketchIcon(group, object, ssIcon) {
  const [point] = object.points;
  const displaySize = Math.max(1.8, object.style.size * 0.55);
  const scale = displaySize / Math.max(ssIcon.width, ssIcon.height);
  const iconGroup = document.createElementNS(SVG_NS, "g");
  iconGroup.setAttribute(
    "transform",
    `translate(${point.x} ${point.y}) scale(${scale}) translate(${-ssIcon.width / 2} ${-ssIcon.height / 2})`
  );

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", ssIcon.path);
  path.setAttribute("fill", object.style.color);
  path.setAttribute("stroke", "none");
  iconGroup.appendChild(path);
  group.appendChild(iconGroup);
}

function renderLegacyIconBadge(group, object, point, size) {
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", String(point.x));
  circle.setAttribute("cy", String(point.y));
  circle.setAttribute("r", String(size * 0.55));
  circle.setAttribute("fill", "rgba(0,0,0,0.55)");
  circle.setAttribute("stroke", object.style.color);
  circle.setAttribute("stroke-width", String(object.style.size * 0.08));
  group.appendChild(circle);
  return circle;
}

function renderRasterLegacyIcon(group, object, point, size) {
  renderLegacyIconBadge(group, object, point, size);
  const glyph = document.createElementNS(SVG_NS, "text");
  glyph.setAttribute("x", String(point.x));
  glyph.setAttribute("y", String(point.y));
  glyph.setAttribute("fill", object.style.color);
  glyph.setAttribute("font-size", String(size * 0.55));
  glyph.setAttribute("text-anchor", "middle");
  glyph.setAttribute("dominant-baseline", "middle");
  glyph.textContent = LEGACY_ICON_GLYPHS[object.meta?.iconId] || "•";
  group.appendChild(glyph);
}

export function renderIcon(group, object, { rasterize = false } = {}) {
  const [point] = object.points;
  const size = Math.max(1.2, object.style.size * 0.35);
  const ssIcon = object.meta?.ssIconId
    ? getStratSketchIconSync(object.meta.ssIconId, ssIconPack)
    : null;

  if (ssIcon) {
    renderStratSketchIcon(group, object, ssIcon);
  } else if (rasterize) {
    renderRasterLegacyIcon(group, object, point, size);
  } else {
    renderLegacyIconBadge(group, object, point, size);
    const iconClass = ICON_MAP[object.meta?.iconId] || "fa-check";
    const foreign = document.createElementNS(SVG_NS, "foreignObject");
    foreign.setAttribute("x", String(point.x - size / 2));
    foreign.setAttribute("y", String(point.y - size / 2));
    foreign.setAttribute("width", String(size));
    foreign.setAttribute("height", String(size));
    foreign.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" class="strat-object__icon"><i class="fa-solid ${iconClass}"></i></div>`;
    group.appendChild(foreign);
  }

  if (object.meta?.iconLabel) {
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", String(point.x));
    label.setAttribute("y", String(point.y + size * 0.75));
    label.setAttribute("fill", object.style.color);
    label.setAttribute("font-size", String(Math.max(0.8, object.style.fontSize * 0.16)));
    label.setAttribute("text-anchor", "middle");
    label.textContent = object.meta.iconLabel;
    group.appendChild(label);
  }
}

export function renderPing(group, object) {
  const [point] = object.points;
  for (let ring = 0; ring < 3; ring += 1) {
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", String(point.x));
    circle.setAttribute("cy", String(point.y));
    circle.setAttribute("r", String(0.35 + ring * 0.35));
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", object.style.color);
    circle.setAttribute("stroke-width", String(object.style.size * 0.06));
    circle.classList.add("strat-object__ping-ring");
    circle.style.animationDelay = `${ring * 0.35}s`;
    group.appendChild(circle);
  }
}
