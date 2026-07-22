/**
 * Mono accessibility trace — obstacle palette only:
 * 1. Binarize overlay pixels matching the 5 MLL obstacle fill colors → black
 * 2. Morphological close to merge nearby fragments
 * 3. Trace connected components → simplified polygons
 *
 * Obstacle fills: red, orange, green, blue, yellow (Maps Let Loose accessibility).
 *
 * Usage:
 *   node scripts/trace-accessibility-mono.mjs              # all maps → *.vectors.json
 *   node scripts/trace-accessibility-mono.mjs --map=Carentan --previews
 *   node scripts/trace-accessibility-mono.mjs --map=Carentan --export-mono --size=4096
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const PNG_DIR = path.join(ROOT, "public", "maps", "accessibility");
const OUT_DIR = path.join(ROOT, "public", "data", "accessibility");
const DIST_OUT_DIR = path.join(ROOT, "dist", "data", "accessibility");
const PREVIEW_DIR = path.join(ROOT, "tmp", "accessibility-mono");

const VECTOR_VERSION = 8;
const ALPHA_THRESHOLD = 40;
/** Per-channel RGB distance from canonical obstacle swatches. */
const COLOR_TOLERANCE = 45;
/** Minimum alpha for blue hatch lines inside outlined zones. */
const BLUE_HATCH_ALPHA_MIN = 1;

/** Canonical obstacle fill colors (Maps Let Loose accessibility overlay). */
const OBSTACLE_FILL_COLORS = [
  { id: "red", r: 255, g: 0, b: 0 },
  { id: "orange", r: 255, g: 127, b: 0 },
  { id: "green", r: 0, g: 255, b: 0 },
  { id: "blue", r: 0, g: 0, b: 255 },
  { id: "yellow", r: 255, g: 255, b: 0 },
];
/** Dilate blue hatch lines to close ~5px gaps into solid fill. */
const BLUE_HATCH_DILATE_PX = 3;
/** Dilate blue outline before interior fill to close small gaps. */
const BLUE_WALL_DILATE_PX = 1;
const MERGE_CLOSE_PX = 2;
const PADDING_PX = 1;
const MIN_COMPONENT_PX = 16;
const RDP_EPSILON_PX = 12;
const SNAP_GRID_PX = 2;
/** Interior angles below this (degrees) require an anchor point. */
const SHARP_CORNER_MAX_DEG = 110;
const ANCHOR_COINCIDE_PX = 2;

function parseArgs(argv) {
  let mapFilter = null;
  let previews = false;
  let exportMono = false;
  let exportSize = 4096;
  for (const arg of argv) {
    if (arg.startsWith("--map=")) mapFilter = arg.slice(6);
    else if (arg === "--previews") previews = true;
    else if (arg === "--export-mono") exportMono = true;
    else if (arg.startsWith("--size=")) exportSize = Number(arg.slice(7));
  }
  if (!Number.isFinite(exportSize) || exportSize < 256) exportSize = 4096;
  return { mapFilter, previews, exportMono, exportSize };
}

function matchesObstacleFill(r, g, b, a) {
  if (a < ALPHA_THRESHOLD) return false;
  return OBSTACLE_FILL_COLORS.some(
    (c) =>
      Math.abs(r - c.r) <= COLOR_TOLERANCE &&
      Math.abs(g - c.g) <= COLOR_TOLERANCE &&
      Math.abs(b - c.b) <= COLOR_TOLERANCE
  );
}

function matchesBlueOutline(r, g, b, a) {
  if (a < ALPHA_THRESHOLD) return false;
  const blue = OBSTACLE_FILL_COLORS.find((c) => c.id === "blue");
  return (
    Math.abs(r - blue.r) <= COLOR_TOLERANCE &&
    Math.abs(g - blue.g) <= COLOR_TOLERANCE &&
    Math.abs(b - blue.b) <= COLOR_TOLERANCE
  );
}

/** Blue hatch infill uses the same hue at low alpha — treat as solid blue. */
function matchesBluePixel(r, g, b, a) {
  if (a < BLUE_HATCH_ALPHA_MIN) return false;
  const blue = OBSTACLE_FILL_COLORS.find((c) => c.id === "blue");
  return (
    Math.abs(r - blue.r) <= COLOR_TOLERANCE &&
    Math.abs(g - blue.g) <= COLOR_TOLERANCE &&
    Math.abs(b - blue.b) <= COLOR_TOLERANCE
  );
}

function isObstaclePixel(data, index) {
  const o = index * 4;
  return matchesObstacleFill(data[o], data[o + 1], data[o + 2], data[o + 3]);
}

/** Flood-fill from image border through non-wall pixels; remainder = enclosed interiors. */
function floodExterior(mask, wall, width, height) {
  const exterior = new Uint8Array(mask.length);
  const queue = [];

  for (let x = 0; x < width; x++) {
    queue.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    queue.push(y * width, y * width + width - 1);
  }

  while (queue.length) {
    const i = queue.pop();
    if (exterior[i] || wall[i]) continue;
    exterior[i] = 1;
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) queue.push(i - 1);
    if (x < width - 1) queue.push(i + 1);
    if (y > 0) queue.push(i - width);
    if (y < height - 1) queue.push(i + width);
  }

  return exterior;
}

/**
 * Blue accessibility zones use an outline + transparent hatched interior.
 * Solidify hatch (low-alpha blue lines + gaps), then flood-fill any remaining
 * transparent pixels enclosed by the blue outline.
 */
function buildObstacleMask(data, width, height) {
  const blocked = new Uint8Array(width * height);
  const blueAny = new Uint8Array(width * height);
  const blueWall = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const a = data[o + 3];

    if (matchesObstacleFill(r, g, b, a)) blocked[i] = 1;
    if (matchesBluePixel(r, g, b, a)) blueAny[i] = 1;
    if (matchesBlueOutline(r, g, b, a)) blueWall[i] = 1;
  }

  if (blueAny.some((v) => v === 1)) {
    const blueSolid = dilateMask(blueAny, width, height, BLUE_HATCH_DILATE_PX);
    for (let i = 0; i < width * height; i++) {
      if (blueSolid[i]) blocked[i] = 1;
    }
  }

  if (blueWall.some((v) => v === 1)) {
    const wall =
      BLUE_WALL_DILATE_PX > 0
        ? dilateMask(blueWall, width, height, BLUE_WALL_DILATE_PX)
        : blueWall;
    const exterior = floodExterior(blocked, wall, width, height);

    for (let i = 0; i < width * height; i++) {
      if (!wall[i] && !exterior[i]) blocked[i] = 1;
    }
  }

  return blocked;
}

function dilateMask(mask, width, height, radius) {
  if (radius <= 0) return mask;
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          out[ny * width + nx] = 1;
        }
      }
    }
  }
  return out;
}

function erodeMask(mask, width, height, radius) {
  if (radius <= 0) return mask;
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      let keep = true;
      for (let dy = -radius; dy <= radius && keep; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !mask[ny * width + nx]) {
            keep = false;
            break;
          }
        }
      }
      if (keep) out[i] = 1;
    }
  }
  return out;
}

function closeMask(mask, width, height, radius) {
  if (radius <= 0) return mask;
  return erodeMask(dilateMask(mask, width, height, radius), width, height, radius);
}

function findComponents(mask, width, height, minComponentPx) {
  const visited = new Uint8Array(mask.length);
  const components = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (!mask[start] || visited[start]) continue;

      let area = 0;
      const pixels = [];
      const queue = [[x, y]];
      visited[start] = 1;

      while (queue.length) {
        const [cx, cy] = queue.pop();
        area++;
        pixels.push([cx, cy]);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (!mask[ni] || visited[ni]) continue;
          visited[ni] = 1;
          queue.push([nx, ny]);
        }
      }

      if (area >= minComponentPx) components.push({ area, pixels });
    }
  }

  return components;
}

function collectBoundaryEdges(cells) {
  const edges = [];
  for (const key of cells) {
    const [gx, gy] = key.split(",").map(Number);
    if (!cells.has(`${gx},${gy - 1}`)) edges.push([gx, gy, gx + 1, gy]);
    if (!cells.has(`${gx + 1},${gy}`)) edges.push([gx + 1, gy, gx + 1, gy + 1]);
    if (!cells.has(`${gx},${gy + 1}`)) edges.push([gx + 1, gy + 1, gx, gy + 1]);
    if (!cells.has(`${gx - 1},${gy}`)) edges.push([gx, gy + 1, gx, gy]);
  }
  return edges;
}

function pickNextVertex(prev, current, options) {
  if (options.length === 1) return options[0];
  const inDir = prev ? { dx: current.x - prev.x, dy: current.y - prev.y } : { dx: 1, dy: 0 };
  return options
    .map((option) => {
      const dx = option.x - current.x;
      const dy = option.y - current.y;
      return { ...option, cross: inDir.dx * dy - inDir.dy * dx };
    })
    .sort((a, b) => b.cross - a.cross)[0];
}

function chainEdgesToPolygon(edges) {
  if (!edges.length) return [];
  const adj = new Map();
  for (const [x1, y1, x2, y2] of edges) {
    const a = `${x1},${y1}`;
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push({ x: x2, y: y2 });
  }
  const [sx, sy] = [edges[0][0], edges[0][1]];
  const polygon = [{ x: sx, y: sy }];
  let prev = null;
  let cx = sx;
  let cy = sy;
  for (let step = 0; step < edges.length + 4; step++) {
    const options = (adj.get(`${cx},${cy}`) || []).filter(
      (option) => !prev || option.x !== prev.x || option.y !== prev.y
    );
    if (!options.length) break;
    const next = pickNextVertex(prev, { x: cx, y: cy }, options);
    if (polygon.length > 2 && next.x === sx && next.y === sy) break;
    polygon.push({ x: next.x, y: next.y });
    prev = { x: cx, y: cy };
    cx = next.x;
    cy = next.y;
  }
  return polygon;
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  const t =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  return Math.hypot(point.x - (lineStart.x + t * dx), point.y - (lineStart.y + t * dy));
}

function rdp(points, epsilon) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[end]];
}

function dedupeConsecutivePoints(polygon) {
  if (polygon.length < 2) return polygon;
  const out = [polygon[0]];
  for (let i = 1; i < polygon.length; i++) {
    const prev = out[out.length - 1];
    const curr = polygon[i];
    if (curr.x !== prev.x || curr.y !== prev.y) out.push(curr);
  }
  return out;
}

function mergeCollinearPoints(polygon) {
  if (polygon.length < 3) return polygon;
  let pts = dedupeConsecutivePoints(polygon.map((p) => ({ ...p })));
  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first.x === last.x && first.y === last.y) pts.pop();
  }
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = out[out.length - 1];
    const curr = pts[i];
    const next = pts[(i + 1) % pts.length];
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const cross = dx1 * dy2 - dy1 * dx2;
    if (cross === 0 && (dx1 !== 0 || dy1 !== 0)) continue;
    out.push(curr);
  }
  return out.length >= 3 ? out : polygon;
}

function isNearPoint(a, b, eps = ANCHOR_COINCIDE_PX) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= eps;
}

function interiorAngleDeg(prev, curr, next) {
  const v1x = prev.x - curr.x;
  const v1y = prev.y - curr.y;
  const v2x = next.x - curr.x;
  const v2y = next.y - curr.y;
  const len1 = Math.hypot(v1x, v1y);
  const len2 = Math.hypot(v2x, v2y);
  if (len1 === 0 || len2 === 0) return 180;
  const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
}

function collectSharpCorners(source, maxInteriorAngleDeg = SHARP_CORNER_MAX_DEG) {
  let ring = dedupeConsecutivePoints(source.map((p) => ({ ...p })));
  if (ring.length < 3) return [];
  if (ring.length > 1 && isNearPoint(ring[0], ring[ring.length - 1], 0.5)) {
    ring = ring.slice(0, -1);
  }

  const sharp = [];
  for (let i = 0; i < ring.length; i++) {
    const prev = ring[(i - 1 + ring.length) % ring.length];
    const curr = ring[i];
    const next = ring[(i + 1) % ring.length];
    if (interiorAngleDeg(prev, curr, next) < maxInteriorAngleDeg) {
      sharp.push({ x: curr.x, y: curr.y });
    }
  }
  return sharp;
}

/** Add anchors for sharp source corners; never remove existing simplified vertices. */
function injectSharpCornerAnchors(
  simplified,
  source,
  maxInteriorAngleDeg = SHARP_CORNER_MAX_DEG
) {
  if (simplified.length < 3 || source.length < 3) return simplified;

  const result = simplified.map((p) => ({ ...p }));
  const insertions = [];

  for (const corner of collectSharpCorners(source, maxInteriorAngleDeg)) {
    if (result.some((p) => isNearPoint(p, corner))) continue;

    let bestEdge = 0;
    let bestDist = Infinity;
    let bestT = 0;
    const n = result.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = result[i];
      const b = result[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      let t = ((corner.x - a.x) * dx + (corner.y - a.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + t * dx;
      const py = a.y + t * dy;
      const dist = Math.hypot(corner.x - px, corner.y - py);
      if (dist < bestDist) {
        bestDist = dist;
        bestEdge = i;
        bestT = t;
      }
    }

    insertions.push({ edge: bestEdge, t: bestT, point: corner });
  }

  insertions.sort((a, b) => b.edge - a.edge || b.t - a.t);
  for (const { edge, point } of insertions) {
    if (result.some((p) => isNearPoint(p, point))) continue;
    result.splice(edge + 1, 0, { x: point.x, y: point.y });
  }

  return result.length >= 3 ? result : simplified;
}

function simplifyMinimalBoundary(polygon) {
  if (polygon.length < 3) return polygon;
  let open = rdp(polygon, RDP_EPSILON_PX);
  if (open.length >= 3) {
    const first = open[0];
    const last = open[open.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) > RDP_EPSILON_PX) {
      open = [...open, { ...first }];
    }
  }
  let simplified = mergeCollinearPoints(open);
  if (SNAP_GRID_PX > 1) {
    simplified = mergeCollinearPoints(
      dedupeConsecutivePoints(
        simplified.map((p) => ({
          x: Math.round(p.x / SNAP_GRID_PX) * SNAP_GRID_PX,
          y: Math.round(p.y / SNAP_GRID_PX) * SNAP_GRID_PX,
        }))
      )
    );
  }
  return simplified.length >= 3 ? simplified : polygon;
}

function pxToMapPct(x, y, width, height) {
  return {
    x: Math.round((x / width) * 100000) / 1000,
    y: Math.round((y / height) * 100000) / 1000,
  };
}

function traceComponent(component) {
  const cells = new Set(component.pixels.map(([x, y]) => `${x},${y}`));
  const edges = collectBoundaryEdges(cells);
  const corners = chainEdgesToPolygon(edges);
  if (corners.length < 3) return null;
  const simplified = simplifyMinimalBoundary(corners);
  const anchored = injectSharpCornerAnchors(simplified, corners);
  return anchored.length >= 3 ? anchored : corners;
}

function buildMonoRgba(blocked, width, height) {
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const isBlocked = blocked[i] === 1;
    out[o] = isBlocked ? 0 : 255;
    out[o + 1] = isBlocked ? 0 : 255;
    out[o + 2] = isBlocked ? 0 : 255;
    out[o + 3] = 255;
  }
  return out;
}

function vectorsToSvg(obstacles, size, { fill, stroke, strokeWidth = 2 }) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
  ];
  for (const o of obstacles) {
    if (o.points.length < 3) continue;
    const pts = o.points.map((p) => `${(p.x / 100) * size},${(p.y / 100) * size}`).join(" ");
    parts.push(
      `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
    );
  }
  parts.push("</svg>");
  return parts.join("");
}

async function writePreviews(mapId, sourcePng, monoRaw, obstacles, width, height) {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  const size = width;

  const monoPath = path.join(PREVIEW_DIR, `${mapId}-mono.png`);
  await sharp(monoRaw, { raw: { width, height, channels: 4 } }).png().toFile(monoPath);

  const vectorSvg = Buffer.from(
    vectorsToSvg(obstacles, size, {
      fill: "rgba(0,220,120,0.35)",
      stroke: "rgba(0,255,160,0.95)",
      strokeWidth: 2,
    })
  );

  const monoVectorsPath = path.join(PREVIEW_DIR, `${mapId}-mono-vectors.png`);
  await sharp(monoRaw, { raw: { width, height, channels: 4 } })
    .composite([{ input: vectorSvg, top: 0, left: 0 }])
    .png()
    .toFile(monoVectorsPath);

  const sourceOverlaySvg = Buffer.from(
    vectorsToSvg(obstacles, size, {
      fill: "rgba(255,80,80,0.35)",
      stroke: "rgba(255,255,255,0.9)",
      strokeWidth: 2,
    })
  );

  const sourceOverlayPath = path.join(PREVIEW_DIR, `${mapId}-source-vectors.png`);
  await sharp(sourcePng)
    .composite([{ input: sourceOverlaySvg, top: 0, left: 0 }])
    .png()
    .toFile(sourceOverlayPath);

  const panelW = size;
  const triptychPath = path.join(PREVIEW_DIR, `${mapId}-triptych.png`);
  await sharp({
    create: {
      width: panelW * 3,
      height: size,
      channels: 3,
      background: { r: 24, g: 24, b: 24 },
    },
  })
    .composite([
      { input: await sharp(sourcePng).resize(size, size).png().toBuffer(), left: 0, top: 0 },
      { input: await sharp(monoPath).resize(size, size).png().toBuffer(), left: panelW, top: 0 },
      {
        input: await sharp(monoVectorsPath).resize(size, size).png().toBuffer(),
        left: panelW * 2,
        top: 0,
      },
    ])
    .png()
    .toFile(triptychPath);

  return { monoPath, monoVectorsPath, sourceOverlayPath, triptychPath };
}

/** Raster mono mask from the original accessibility PNG (not vector-rendered). */
async function exportMonoOverlay(mapId, outputSize) {
  const pngPath = path.join(PNG_DIR, `${mapId}_Accessible.png`);
  if (!fs.existsSync(pngPath)) {
    console.error(`Missing ${pngPath}`);
    return null;
  }

  const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const blocked = buildObstacleMask(data, width, height);
  const monoRaw = buildMonoRgba(blocked, width, height);

  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  const outPath = path.join(PREVIEW_DIR, `${mapId}-mono-overlay-${outputSize}.png`);

  let pipeline = sharp(monoRaw, { raw: { width, height, channels: 4 } });
  if (outputSize !== width) {
    pipeline = pipeline.resize(outputSize, outputSize, { kernel: sharp.kernel.nearest });
  }
  await pipeline.png({ compressionLevel: 6 }).toFile(outPath);

  return outPath;
}

async function traceMonoMap(mapId, { writePreviews: shouldWritePreviews = false } = {}) {
  const pngPath = path.join(PNG_DIR, `${mapId}_Accessible.png`);
  if (!fs.existsSync(pngPath)) {
    console.error(`Missing ${pngPath}`);
    return null;
  }

  const meta = await sharp(pngPath).metadata();
  const width = meta.width;
  const height = meta.height;

  const { data } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const blocked = buildObstacleMask(data, width, height);
  const monoRaw = buildMonoRgba(blocked, width, height);

  const rawComponents = findComponents(blocked, width, height, MIN_COMPONENT_PX).length;
  let mask = closeMask(blocked, width, height, MERGE_CLOSE_PX);
  mask = dilateMask(mask, width, height, PADDING_PX);
  const components = findComponents(mask, width, height, MIN_COMPONENT_PX);

  const obstacles = [];
  for (const component of components) {
    const polygon = traceComponent(component);
    if (!polygon) continue;
    obstacles.push({
      id: `acc-${mapId}-${obstacles.length}`,
      type: "polygon",
      effect: "block",
      source: "accessibility",
      traceVersion: VECTOR_VERSION,
      points: polygon.map((p) => pxToMapPct(p.x, p.y, width, height)),
      areaPx: component.area,
    });
  }

  obstacles.sort((a, b) => b.areaPx - a.areaPx);
  for (const obstacle of obstacles) delete obstacle.areaPx;

  const vertexCounts = obstacles.map((o) => o.points.length);
  const payload = {
    version: VECTOR_VERSION,
    mapId,
    sourceSize: width,
    traceMode: "mono-palette",
    obstacleColors: OBSTACLE_FILL_COLORS.map((c) => c.id),
    blueFillMode: "hatch-solidify-plus-interior",
    blueHatchAlphaMin: BLUE_HATCH_ALPHA_MIN,
    blueHatchDilatePx: BLUE_HATCH_DILATE_PX,
    blueWallDilatePx: BLUE_WALL_DILATE_PX,
    alphaThreshold: ALPHA_THRESHOLD,
    colorTolerance: COLOR_TOLERANCE,
    mergeClosePx: MERGE_CLOSE_PX,
    rdpEpsilonPx: RDP_EPSILON_PX,
    sharpCornerMaxDeg: SHARP_CORNER_MAX_DEG,
    obstacleCount: obstacles.length,
    obstacles,
    stats: {
      rawComponentsBeforeMerge: rawComponents,
      mergedComponents: components.length,
      vertices: vertexCounts.reduce((sum, n) => sum + n, 0),
      avgVertices:
        vertexCounts.length > 0
          ? Math.round((vertexCounts.reduce((sum, n) => sum + n, 0) / vertexCounts.length) * 10) /
            10
          : 0,
    },
  };

  const previews = shouldWritePreviews
    ? await writePreviews(mapId, pngPath, monoRaw, obstacles, width, height)
    : null;

  return { payload, previews };
}

async function main() {
  const { mapFilter, previews, exportMono, exportSize } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(PNG_DIR)) {
    console.error(`Missing PNG dir ${PNG_DIR}`);
    process.exit(1);
  }

  let mapIds = fs
    .readdirSync(PNG_DIR)
    .filter((name) => name.endsWith("_Accessible.png"))
    .map((name) => name.replace("_Accessible.png", ""));

  if (mapFilter) {
    mapIds = mapIds.filter((id) => id.toLowerCase() === mapFilter.toLowerCase());
    if (!mapIds.length) {
      console.error(`No accessibility PNG found for map "${mapFilter}"`);
      process.exit(1);
    }
  }

  if (exportMono) {
    for (const mapId of mapIds) {
      const outPath = await exportMonoOverlay(mapId, exportSize);
      if (outPath) {
        console.log(`Wrote ${outPath} (mono from original overlay @ ${exportSize}px)`);
      }
    }
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let count = 0;
  for (const mapId of mapIds) {
    const result = await traceMonoMap(mapId, { writePreviews: previews || Boolean(mapFilter) });
    if (!result) continue;

    const { payload } = result;
    const json = JSON.stringify(payload);
    const outPath = path.join(OUT_DIR, `${mapId}.vectors.json`);
    fs.writeFileSync(outPath, json);

    if (fs.existsSync(path.join(ROOT, "dist"))) {
      fs.mkdirSync(DIST_OUT_DIR, { recursive: true });
      fs.writeFileSync(path.join(DIST_OUT_DIR, `${mapId}.vectors.json`), json);
    }

    console.log(
      `Wrote ${outPath} — ${payload.obstacleCount} shapes, ${payload.stats.vertices} vertices (avg ${payload.stats.avgVertices})`
    );
    console.log(
      `  components: ${payload.stats.rawComponentsBeforeMerge} raw → ${payload.stats.mergedComponents} merged`
    );

    if (result.previews) {
      console.log("Previews:");
      for (const [key, filePath] of Object.entries(result.previews)) {
        console.log(`  ${key}: ${filePath}`);
      }
    }

    count++;
  }

  console.log(`Done: ${count} vector map(s) [mono-palette v${VECTOR_VERSION}]`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
