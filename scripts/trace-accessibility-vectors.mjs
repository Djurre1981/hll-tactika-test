/**
 * Trace accessibility PNG overlays into high-accuracy vector polygons.
 * Each connected blocked region is traced at native PNG resolution (1920²)
 * by following pixel boundaries — matching the overlay template exactly.
 *
 * Source: public/maps/accessibility/{MapId}_Accessible.png
 * Output: public/data/accessibility/{mapId}.vectors.json
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const PNG_DIR = path.join(ROOT, "public", "maps", "accessibility");
const OUT_DIR = path.join(ROOT, "public", "data", "accessibility");

const VECTOR_VERSION = 2;
const ALPHA_THRESHOLD = 40;
const COLOR_THRESHOLD = 24;
const PADDING_PX = 1;
const MIN_COMPONENT_PX = 16;
const RDP_EPSILON_PX = 0.8;

function isBlockedPixel(data, index) {
  const o = index * 4;
  const alpha = data[o + 3];
  const rgb = data[o] + data[o + 1] + data[o + 2];
  return alpha >= ALPHA_THRESHOLD && rgb >= COLOR_THRESHOLD;
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

function findComponents(mask, width, height) {
  const visited = new Uint8Array(mask.length);
  const components = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (!mask[start] || visited[start]) continue;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;
      const pixels = [];
      const queue = [[x, y]];
      visited[start] = 1;

      while (queue.length) {
        const [cx, cy] = queue.pop();
        area++;
        pixels.push([cx, cy]);
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

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

      if (area >= MIN_COMPONENT_PX) {
        components.push({ minX, minY, maxX, maxY, area, pixels });
      }
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
  const inDir = prev
    ? { dx: current.x - prev.x, dy: current.y - prev.y }
    : { dx: 1, dy: 0 };

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
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }
  const t =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
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

function simplifyOrthogonal(points, epsilon = RDP_EPSILON_PX) {
  if (points.length <= 4) return points;
  const open = rdp(points, epsilon);
  if (open.length < 3) return points;

  const closed = [...open];
  const first = open[0];
  const last = open[open.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) > epsilon) {
    closed.push({ ...first });
  }

  return closed.length >= 3 ? closed : points;
}

function pxToMapPct(x, y, width, height) {
  return {
    x: Math.round((x / width) * 100000) / 1000,
    y: Math.round((y / height) * 100000) / 1000,
  };
}

function traceComponentPolygon(component) {
  const cells = new Set(component.pixels.map(([x, y]) => `${x},${y}`));
  const edges = collectBoundaryEdges(cells);
  const corners = chainEdgesToPolygon(edges);
  if (corners.length < 3) return null;

  const simplified = simplifyOrthogonal(corners);
  return simplified.length >= 3 ? simplified : corners;
}

async function traceMap(mapId) {
  const pngPath = path.join(PNG_DIR, `${mapId}_Accessible.png`);
  if (!fs.existsSync(pngPath)) {
    console.warn(`skip ${mapId}: missing ${pngPath}`);
    return null;
  }

  const meta = await sharp(pngPath).metadata();
  const width = meta.width;
  const height = meta.height;

  const { data } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const blocked = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    blocked[i] = isBlockedPixel(data, i) ? 1 : 0;
  }

  const mask = dilateMask(blocked, width, height, PADDING_PX);
  const components = findComponents(mask, width, height);
  const obstacles = [];

  for (const component of components) {
    const polygon = traceComponentPolygon(component);
    if (!polygon) continue;

    const points = polygon.map((point) => pxToMapPct(point.x, point.y, width, height));
    obstacles.push({
      id: `acc-${mapId}-${obstacles.length}`,
      type: "polygon",
      effect: "block",
      source: "accessibility",
      traceVersion: VECTOR_VERSION,
      points,
      areaPx: component.area,
    });
  }

  obstacles.sort((a, b) => b.areaPx - a.areaPx);
  for (const obstacle of obstacles) delete obstacle.areaPx;

  return {
    version: VECTOR_VERSION,
    mapId,
    sourceSize: width,
    paddingPx: PADDING_PX,
    obstacleCount: obstacles.length,
    obstacles,
    stats: {
      components: components.length,
      vertices: obstacles.reduce((sum, o) => sum + o.points.length, 0),
    },
  };
}

async function main() {
  if (!fs.existsSync(PNG_DIR)) {
    console.error(`Missing PNG dir ${PNG_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const mapIds = fs
    .readdirSync(PNG_DIR)
    .filter((name) => name.endsWith("_Accessible.png"))
    .map((name) => name.replace("_Accessible.png", ""));

  let count = 0;
  for (const mapId of mapIds) {
    const payload = await traceMap(mapId);
    if (!payload) continue;
    const outPath = path.join(OUT_DIR, `${mapId}.vectors.json`);
    fs.writeFileSync(outPath, JSON.stringify(payload));
    console.log(
      `Wrote ${outPath} — ${payload.obstacleCount} shapes, ${payload.stats.vertices} vertices`
    );
    count++;
  }

  console.log(`Done: ${count} vector maps`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
