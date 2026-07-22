import { MAP_PCT_MAX, MAP_PCT_MIN } from "../constants.js";

function gridCornerToMapPct(gx, gy, gridSize) {
  const span = MAP_PCT_MAX - MAP_PCT_MIN;
  return {
    x: MAP_PCT_MIN + (gx / gridSize) * span,
    y: MAP_PCT_MIN + (gy / gridSize) * span,
  };
}

function collectComponentCells(blocked, size, startGx, startGy, visited) {
  const cells = new Set();
  const queue = [[startGx, startGy]];
  const start = startGy * size + startGx;
  visited[start] = 1;

  while (queue.length) {
    const [cx, cy] = queue.pop();
    cells.add(`${cx},${cy}`);

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const ni = ny * size + nx;
      if (!blocked[ni] || visited[ni]) continue;
      visited[ni] = 1;
      queue.push([nx, ny]);
    }
  }

  return cells;
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

function simplifyCollinear(points) {
  if (points.length <= 3) return points;
  const out = [];
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const cross =
      (cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x);
    if (Math.abs(cross) > 1e-9) out.push(cur);
  }

  return out.length >= 3 ? out : points;
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

  return simplifyCollinear(polygon);
}

function componentToPolygon(cells, gridSize) {
  const edges = collectBoundaryEdges(cells);
  const corners = chainEdgesToPolygon(edges);
  if (corners.length < 3) return null;

  return corners.map((corner) => gridCornerToMapPct(corner.x, corner.y, gridSize));
}

/** Flood-fill blocked cells into editable polygon obstacles (one shape per connected region). */
export function extractObstaclesFromGrid(grid) {
  const size = grid.gridSize;
  const blocked = grid.blocked;
  const visited = new Uint8Array(size * size);
  const obstacles = [];

  for (let gy = 0; gy < size; gy++) {
    for (let gx = 0; gx < size; gx++) {
      const start = gy * size + gx;
      if (!blocked[start] || visited[start]) continue;

      const cells = collectComponentCells(blocked, size, gx, gy, visited);
      const points = componentToPolygon(cells, size);
      if (!points || points.length < 3) continue;

      obstacles.push({
        id: `acc-${gx}-${gy}-${obstacles.length}`,
        type: "polygon",
        effect: "block",
        source: "accessibility",
        points,
      });
    }
  }

  return obstacles;
}

export function needsObstacleExtraction(obstacles = []) {
  if (!obstacles.length) return true;
  return obstacles.some((o) => o.source === "accessibility" && o.type !== "polygon");
}
