import { getObjectBounds } from "./strat-object-schema.js";
import {
  renderPen,
  renderLine,
  renderRect,
  renderEllipse,
  renderText,
  renderIcon,
  renderPing,
} from "./renderers/strat-draw-renderers.js";

export { renderSelectionOverlay } from "./strat-selection-handles.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function dashArray(lineType, size) {
  if (lineType === "dashed") return `${size * 2.5} ${size * 1.5}`;
  if (lineType === "dotted") return `${size * 0.6} ${size * 1.2}`;
  return null;
}

export function setStrokeAttributes(element, style) {
  element.setAttribute("stroke", style.color);
  element.setAttribute("stroke-width", String(style.size * 0.12));
  element.setAttribute("stroke-linecap", "round");
  element.setAttribute("stroke-linejoin", "round");
  const dash = dashArray(style.lineType, style.size);
  if (dash) {
    element.setAttribute("stroke-dasharray", dash);
  }
}

function createBaseGroup(object, { selected = false, preview = false } = {}) {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", "strat-object");
  group.dataset.stratObjectId = object.id;
  if (selected) group.classList.add("is-selected");
  if (preview) group.classList.add("is-preview");

  if (selected) {
    const bounds = getObjectBounds(object);
    if (bounds) {
      const highlight = document.createElementNS(SVG_NS, "rect");
      highlight.setAttribute("class", "strat-object__selection");
      highlight.setAttribute("x", String(bounds.x));
      highlight.setAttribute("y", String(bounds.y));
      highlight.setAttribute("width", String(bounds.w));
      highlight.setAttribute("height", String(bounds.h));
      highlight.setAttribute("fill", "none");
      highlight.setAttribute("stroke", "rgba(255,255,255,0.75)");
      highlight.setAttribute("stroke-width", "0.12");
      highlight.setAttribute("stroke-dasharray", "0.35 0.25");
      group.appendChild(highlight);
    }
  }

  return group;
}

export function renderStratObject(object, options = {}) {
  const group = createBaseGroup(object, options);
  const { rasterize = false } = options;

  switch (object.type) {
    case "pen":
      renderPen(group, object);
      break;
    case "line":
      renderLine(group, object);
      break;
    case "arrow":
      renderLine(group, object, { arrow: true });
      break;
    case "rect":
      renderRect(group, object);
      break;
    case "ellipse":
      renderEllipse(group, object);
      break;
    case "text":
      renderText(group, object);
      break;
    case "icon":
      renderIcon(group, object, { rasterize });
      break;
    case "ping":
      renderPing(group, object);
      break;
    default:
      break;
  }

  return group;
}

export function renderStratObjects(objects, { selectedId = null, preview = null, rasterize = false } = {}) {
  const fragment = document.createDocumentFragment();
  const sorted = [...objects].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  for (const object of sorted) {
    fragment.appendChild(renderStratObject(object, { selected: object.id === selectedId, rasterize }));
  }

  if (preview) {
    fragment.appendChild(renderStratObject(preview, { preview: true, rasterize }));
  }

  return fragment;
}

export function renderStratSlideOverlaySvg(objects) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.appendChild(renderStratObjects(objects || [], { rasterize: true }));
  return svg;
}

export function renderRasterSlide(imageUrl) {
  const fragment = document.createDocumentFragment();
  const image = document.createElementNS(SVG_NS, "image");
  image.setAttribute("href", imageUrl);
  image.setAttribute("x", "0");
  image.setAttribute("y", "0");
  image.setAttribute("width", "100");
  image.setAttribute("height", "100");
  image.setAttribute("preserveAspectRatio", "xMidYMid meet");
  fragment.appendChild(image);
  return fragment;
}

export function renderStratThumbnail(objects, mapImageSrc, { rasterUrl } = {}) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.setAttribute("class", "strats-slides__thumb-svg");

  if (rasterUrl) {
    svg.appendChild(renderRasterSlide(rasterUrl));
    return svg;
  }

  if (mapImageSrc) {
    const image = document.createElementNS(SVG_NS, "image");
    image.setAttribute("href", mapImageSrc);
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("width", "100");
    image.setAttribute("height", "100");
    image.setAttribute("preserveAspectRatio", "xMidYMid slice");
    svg.appendChild(image);
  }

  const overlay = document.createElementNS(SVG_NS, "g");
  overlay.setAttribute("opacity", "0.92");
  overlay.appendChild(renderStratObjects(objects || []));
  svg.appendChild(overlay);
  return svg;
}
