/**
 * Trace accessibility PNG overlays into vector polygons for pathfinding.
 *
 * Modes:
 * - boundary (v2): pixel-boundary trace with light RDP — legacy, high vertex count
 * - orthogonal (v3): PNG footprint preserved; RDP collapses pixel stair-steps so
 *   diagonals become single straight segments with anchors only at real corners
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

const ALPHA_THRESHOLD = 40;
const COLOR_THRESHOLD = 24;
const RDP_EPSILON_PX = 0.8;

const MODES = {
  boundary: {
    version: 2,
    paddingPx: 0,
    minComponentPx: 16,
    closeRadius: 0,
    rdpEpsilonPx: RDP_EPSILON_PX,
    snapGridPx: 0,
  },
  orthogonal: {
    version: 3,
    paddingPx: 0,
    minComponentPx: 16,
    closeRadius: 0,
    rdpEpsilonPx: 12,
    snapGridPx: 2,
  },
};

function parseArgs(argv) {
  let mapFilter = null;
  let mode = "boundary";
  for (const arg of argv) {
    if (arg.startsWith("--map=")) mapFilter = arg.slice(6);
    else if (arg === "--orthogonal" || arg === "--mode=orthogonal") mode = "orthogonal";
    else if (arg === "--rectangles" || arg === "--mode=rectangles") mode = "orthogonal";
    else if (arg.startsWith("--mode=")) mode = arg.slice(7);
  }
  if (!MODES[mode]) {
    console.error(`Unknown mode "${mode}". Use boundary or orthogonal.`);
    process.exit(1);
  }
  return { mapFilter, mode };
}

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

      if (area >= minComponentPx) {
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

function snapPolygonToGrid(polygon, gridPx) {
  if (gridPx <= 1) return polygon;
  return polygon.map((p) => ({
    x: Math.round(p.x / gridPx) * gridPx,
    y: Math.round(p.y / gridPx) * gridPx,
  }));
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

  let pts = dedupeConsecutivePoints(polygon.map((p) => ({ x: p.x, y: p.y })));
  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first.x === last.x && first.y === last.y) pts.pop();
  }
  if (pts.length < 3) return polygon;

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

  if (out.length > 2) {
    const first = out[0];
    const last = out[out.length - 1];
    if (first.x === last.x && first.y === last.y) out.pop();
  }

  return out.length >= 3 ? out : polygon;
}

/** Collapse pixel stair-steps; keep straight diagonals as one segment between corners. */
function simplifyMinimalBoundary(polygon, rdpEpsilonPx = 12, snapGridPx = 0) {
  if (polygon.length < 3) return polygon;

  let simplified = simplifyOrthogonal(polygon, rdpEpsilonPx);
  simplified = mergeCollinearPoints(simplified);

  if (snapGridPx > 1) {
    simplified = mergeCollinearPoints(
      dedupeConsecutivePoints(snapPolygonToGrid(simplified, snapGridPx))
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

function traceComponentBoundary(component, minimal, rdpEpsilonPx = 12, snapGridPx = 0) {
  const cells = new Set(component.pixels.map(([x, y]) => `${x},${y}`));
  const edges = collectBoundaryEdges(cells);
  const corners = chainEdgesToPolygon(edges);
  if (corners.length < 3) return null;

  if (minimal) {
    const simplified = simplifyMinimalBoundary(corners, rdpEpsilonPx, snapGridPx);
    return simplified.length >= 3 ? simplified : corners;
  }

  const simplified = simplifyOrthogonal(corners);
  return simplified.length >= 3 ? simplified : corners;
}

async function traceMap(mapId, modeConfig) {
  const { version, paddingPx, minComponentPx, closeRadius, rdpEpsilonPx = 12, snapGridPx = 0 } =
    modeConfig;
  const minimal = version >= 3;

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

  let mask = closeRadius > 0 ? closeMask(blocked, width, height, closeRadius) : blocked;
  mask = dilateMask(mask, width, height, paddingPx);

  const components = findComponents(mask, width, height, minComponentPx);
  const obstacles = [];

  for (const component of components) {
    const polygon = traceComponentBoundary(component, minimal, rdpEpsilonPx, snapGridPx);
    if (!polygon) continue;

    const points = polygon.map((point) => pxToMapPct(point.x, point.y, width, height));
    obstacles.push({
      id: `acc-${mapId}-${obstacles.length}`,
      type: "polygon",
      effect: "block",
      source: "accessibility",
      traceVersion: version,
      points,
      areaPx: component.area,
    });
  }

  obstacles.sort((a, b) => b.areaPx - a.areaPx);
  for (const obstacle of obstacles) delete obstacle.areaPx;

  const vertexCounts = obstacles.map((o) => o.points.length);

  return {
    version,
    mapId,
    sourceSize: width,
    paddingPx,
    closeRadiusPx: closeRadius,
    rdpEpsilonPx: minimal ? rdpEpsilonPx : RDP_EPSILON_PX,
    snapGridPx: minimal ? snapGridPx : 0,
    traceMode: minimal ? "minimal" : "boundary",
    obstacleCount: obstacles.length,
    obstacles,
    stats: {
      components: components.length,
      vertices: vertexCounts.reduce((sum, n) => sum + n, 0),
      avgVertices:
        vertexCounts.length > 0
          ? Math.round((vertexCounts.reduce((sum, n) => sum + n, 0) / vertexCounts.length) * 10) / 10
          : 0,
      fourCornerShapes: vertexCounts.filter((n) => n === 4).length,
    },
  };
}

async function main() {
  const { mapFilter, mode } = parseArgs(process.argv.slice(2));
  const modeConfig = MODES[mode];

  if (!fs.existsSync(PNG_DIR)) {
    console.error(`Missing PNG dir ${PNG_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
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

  let count = 0;
  for (const mapId of mapIds) {
    const payload = await traceMap(mapId, modeConfig);
    if (!payload) continue;
    const outPath = path.join(OUT_DIR, `${mapId}.vectors.json`);
    fs.writeFileSync(outPath, JSON.stringify(payload));
    console.log(
      `Wrote ${outPath} [${payload.traceMode}] — ${payload.obstacleCount} shapes, ${payload.stats.vertices} vertices (avg ${payload.stats.avgVertices}, ${payload.stats.fourCornerShapes} rects)`
    );
    count++;
  }

  console.log(`Done: ${count} vector map(s) using mode "${mode}"`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
