export const MG_SPOT_COLOR = "#d94f3d";

const BASE_RADIUS = 0.55;
const STEM_WIDTH = 0.28;
const HEAD_LENGTH = 1.1;
const HEAD_WIDTH = 0.65;

export function hasPinDirection(pin) {
  return (
    pin &&
    Number.isFinite(pin.dirX) &&
    Number.isFinite(pin.dirY) &&
    (pin.dirX !== pin.x || pin.dirY !== pin.y)
  );
}

export function buildMgSpotSvgContent(baseX, baseY, tipX, tipY, { stem = true } = {}) {
  const fragment = document.createDocumentFragment();

  const base = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  base.setAttribute("class", "mg-spot-base");
  base.setAttribute("cx", String(baseX));
  base.setAttribute("cy", String(baseY));
  base.setAttribute("r", String(BASE_RADIUS));
  fragment.appendChild(base);

  if (!stem || tipX == null || tipY == null) {
    return { fragment, stemWidth: STEM_WIDTH };
  }

  const dx = tipX - baseX;
  const dy = tipY - baseY;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;

  const backX = tipX - ux * HEAD_LENGTH;
  const backY = tipY - uy * HEAD_LENGTH;
  const wing1X = backX + px * HEAD_WIDTH;
  const wing1Y = backY + py * HEAD_WIDTH;
  const wing2X = backX - px * HEAD_WIDTH;
  const wing2Y = backY - py * HEAD_WIDTH;

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("class", "mg-spot-stem");
  line.setAttribute("x1", String(baseX));
  line.setAttribute("y1", String(baseY));
  line.setAttribute("x2", String(tipX));
  line.setAttribute("y2", String(tipY));

  const head = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  head.setAttribute("class", "mg-spot-head");
  head.setAttribute(
    "points",
    `${tipX},${tipY} ${wing1X},${wing1Y} ${wing2X},${wing2Y}`
  );

  fragment.append(line, head);
  return { fragment, stem: line, base, head, stemWidth: STEM_WIDTH };
}

export function renderMgSpotGroup(pin, { draft = false, highlighted = false } = {}) {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", "map-mg-spot");
  if (draft) {
    group.classList.add("map-mg-spot--draft");
  }
  if (highlighted) {
    group.classList.add("is-highlighted");
  }
  if (pin.id) {
    group.dataset.id = pin.id;
  }

  const parts = buildMgSpotSvgContent(pin.x, pin.y, pin.dirX, pin.dirY);
  if (parts.stem) {
    parts.stem.setAttribute("stroke-width", String(parts.stemWidth));
  }
  group.appendChild(parts.fragment);
  return group;
}

export function clearSvgElement(svg) {
  if (!svg) return;
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }
}

export function renderDraftMgSpot(svg, base, tip, { preview = false } = {}) {
  clearSvgElement(svg);
  if (!base) {
    svg.classList.add("hidden");
    return;
  }

  const parts = buildMgSpotSvgContent(base.x, base.y, tip?.x ?? null, tip?.y ?? null, {
    stem: Boolean(tip),
  });
  if (parts.stem) {
    parts.stem.setAttribute("stroke-width", String(parts.stemWidth));
    if (preview) {
      parts.stem.classList.add("mg-spot-stem--preview");
      parts.head?.classList.add("mg-spot-head--preview");
    }
  }

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", "map-mg-spot map-mg-spot--draft");
  group.appendChild(parts.fragment);
  svg.appendChild(group);
  svg.classList.remove("hidden");
}
