const MIN_VERTICES = 3;
const REFERENCE_SIZE = 11796.48;
const REFERENCE_FLATTEN = 1.25;
const REFERENCE_MIN_AREA = 96;

export function parseViewBox(svg) {
  const match = svg.match(/viewBox=["']([^"']+)["']/i);
  if (!match) return { x: 0, y: 0, width: 100, height: 100 };
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length === 4) return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  return { x: 0, y: 0, width: parts[0] || 100, height: parts[1] || parts[0] || 100 };
}

export function importOptionsForViewBox(viewBox) {
  const scale = Math.max(viewBox.width, viewBox.height) / REFERENCE_SIZE;
  return {
    flattenTolerance: REFERENCE_FLATTEN * scale,
    minAreaSvg: REFERENCE_MIN_AREA * scale * scale,
  };
}

function isWhiteShape(attrs) {
  if (/\bcls-1\b/.test(attrs)) return true;
  if (/fill\s*:\s*#fff/i.test(attrs)) return true;
  if (/fill=["']#fff/i.test(attrs)) return true;
  if (/fill=["']white/i.test(attrs)) return true;
  if (/fill=["']rgb\(255,\s*255,\s*255\)/i.test(attrs)) return true;
  return false;
}

function isBlackShape(attrs) {
  if (/fill=["']#000/i.test(attrs)) return true;
  if (/fill=["']black/i.test(attrs)) return true;
  if (/fill=["']rgb\(0,\s*0,\s*0\)/i.test(attrs)) return true;
  return false;
}

function extractShapes(svg, { skipWhite, blackOnly }) {
  const shapes = [];
  const pathRe = /<path\b([^>]*?)\/?>/gi;
  for (const match of svg.matchAll(pathRe)) {
    const attrs = match[1];
    if (skipWhite && isWhiteShape(attrs)) continue;
    if (blackOnly && !isBlackShape(attrs) && /fill=/i.test(attrs)) continue;
    const dMatch = attrs.match(/\bd=["']([^"']+)["']/i);
    if (!dMatch) continue;
    shapes.push({ kind: "path", d: dMatch[1] });
  }

  const polyRe = /<polygon\b([^>]*?)\/?>/gi;
  for (const match of svg.matchAll(polyRe)) {
    const attrs = match[1];
    if (skipWhite && isWhiteShape(attrs)) continue;
    if (blackOnly && !isBlackShape(attrs) && /fill=/i.test(attrs)) continue;
    const ptsMatch = attrs.match(/\bpoints=["']([^"']+)["']/i);
    if (!ptsMatch) continue;
    shapes.push({ kind: "polygon", points: ptsMatch[1] });
  }

  return shapes;
}

function tokenizePath(d) {
  return d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
}

function readNumber(tokens, index) {
  return Number(tokens[index]);
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function lerp(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function flattenCubic(p0, p1, p2, p3, tol, out) {
  const d1 = dist(p0, p3);
  const d2 = dist(p0, p1) + dist(p1, p2) + dist(p2, p3);
  if (d2 - d1 <= tol) {
    out.push(p3);
    return;
  }
  const p01 = lerp(p0, p1, 0.5);
  const p12 = lerp(p1, p2, 0.5);
  const p23 = lerp(p2, p3, 0.5);
  const p012 = lerp(p01, p12, 0.5);
  const p123 = lerp(p12, p23, 0.5);
  const p0123 = lerp(p012, p123, 0.5);
  flattenCubic(p0, p01, p012, p0123, tol, out);
  flattenCubic(p0123, p123, p23, p3, tol, out);
}

function flattenQuadratic(p0, p1, p2, tol, out) {
  flattenCubic(p0, lerp(p0, p1, 2 / 3), lerp(p1, p2, 1 / 3), p2, tol, out);
}

function parsePathSubpaths(d, tol) {
  const tokens = tokenizePath(d);
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let prevCmd = "";
  const subpaths = [];
  let current = [];

  function pushPoint(x, y) {
    const p = { x, y };
    if (!current.length || dist(current[current.length - 1], p) > 1e-4) {
      current.push(p);
    }
    cx = x;
    cy = y;
  }

  function closeSubpath() {
    if (current.length >= MIN_VERTICES) {
      subpaths.push(current);
    }
    current = [];
  }

  while (i < tokens.length) {
    let cmd = tokens[i];
    if (!/[a-zA-Z]/.test(cmd)) {
      if (!prevCmd) break;
      cmd = prevCmd;
    } else {
      i += 1;
    }

    const rel = cmd === cmd.toLowerCase();
    const type = cmd.toUpperCase();
    prevCmd = type === "M" ? "L" : type === "Z" ? prevCmd : type;

    switch (type) {
      case "M": {
        if (current.length) closeSubpath();
        while (i + 1 < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const x = readNumber(tokens, i) + (rel ? cx : 0);
          const y = readNumber(tokens, i + 1) + (rel ? cy : 0);
          i += 2;
          if (!current.length) {
            current.push({ x, y });
            sx = x;
            sy = y;
            cx = x;
            cy = y;
          } else {
            pushPoint(x, y);
          }
        }
        break;
      }
      case "L": {
        while (i + 1 < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const x = readNumber(tokens, i) + (rel ? cx : 0);
          const y = readNumber(tokens, i + 1) + (rel ? cy : 0);
          i += 2;
          pushPoint(x, y);
        }
        break;
      }
      case "H": {
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const x = readNumber(tokens, i) + (rel ? cx : 0);
          i += 1;
          pushPoint(x, cy);
        }
        break;
      }
      case "V": {
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const y = readNumber(tokens, i) + (rel ? cy : 0);
          i += 1;
          pushPoint(cx, y);
        }
        break;
      }
      case "C": {
        while (i + 5 < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const p0 = { x: cx, y: cy };
          const p1 = { x: readNumber(tokens, i) + (rel ? cx : 0), y: readNumber(tokens, i + 1) + (rel ? cy : 0) };
          const p2 = { x: readNumber(tokens, i + 2) + (rel ? cx : 0), y: readNumber(tokens, i + 3) + (rel ? cy : 0) };
          const p3 = { x: readNumber(tokens, i + 4) + (rel ? cx : 0), y: readNumber(tokens, i + 5) + (rel ? cy : 0) };
          i += 6;
          flattenCubic(p0, p1, p2, p3, tol, current);
          cx = p3.x;
          cy = p3.y;
        }
        break;
      }
      case "S": {
        while (i + 3 < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const p0 = { x: cx, y: cy };
          const p2 = { x: readNumber(tokens, i) + (rel ? cx : 0), y: readNumber(tokens, i + 1) + (rel ? cy : 0) };
          const p3 = { x: readNumber(tokens, i + 2) + (rel ? cx : 0), y: readNumber(tokens, i + 3) + (rel ? cy : 0) };
          i += 4;
          const p1 =
            current.length >= 2
              ? { x: 2 * cx - current[current.length - 2].x, y: 2 * cy - current[current.length - 2].y }
              : p0;
          flattenCubic(p0, p1, p2, p3, tol, current);
          cx = p3.x;
          cy = p3.y;
        }
        break;
      }
      case "Q": {
        while (i + 3 < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const p0 = { x: cx, y: cy };
          const p1 = { x: readNumber(tokens, i) + (rel ? cx : 0), y: readNumber(tokens, i + 1) + (rel ? cy : 0) };
          const p2 = { x: readNumber(tokens, i + 2) + (rel ? cx : 0), y: readNumber(tokens, i + 3) + (rel ? cy : 0) };
          i += 4;
          flattenQuadratic(p0, p1, p2, tol, current);
          cx = p2.x;
          cy = p2.y;
        }
        break;
      }
      case "T": {
        while (i + 1 < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const p0 = { x: cx, y: cy };
          const p2 = { x: readNumber(tokens, i) + (rel ? cx : 0), y: readNumber(tokens, i + 1) + (rel ? cy : 0) };
          i += 2;
          const p1 =
            current.length >= 2
              ? { x: 2 * cx - current[current.length - 2].x, y: 2 * cy - current[current.length - 2].y }
              : p0;
          flattenQuadratic(p0, p1, p2, tol, current);
          cx = p2.x;
          cy = p2.y;
        }
        break;
      }
      case "A": {
        while (i + 6 < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          const x = readNumber(tokens, i + 5) + (rel ? cx : 0);
          const y = readNumber(tokens, i + 6) + (rel ? cy : 0);
          i += 7;
          pushPoint(x, y);
        }
        break;
      }
      case "Z": {
        if (current.length) {
          pushPoint(sx, sy);
          closeSubpath();
        }
        cx = sx;
        cy = sy;
        break;
      }
      default:
        break;
    }
  }

  if (current.length >= MIN_VERTICES) closeSubpath();
  return subpaths;
}

function parsePolygonPoints(pointsStr) {
  const nums = pointsStr.trim().split(/[\s,]+/).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i], y: nums[i + 1] });
  }
  return pts.length >= MIN_VERTICES ? [pts] : [];
}

function polygonAreaSvg(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

export function svgToMapPct(x, y, viewBox) {
  const nx = ((x - viewBox.x) / viewBox.width) * 100;
  const ny = ((y - viewBox.y) / viewBox.height) * 100;
  return {
    x: Math.round(nx * 1000) / 1000,
    y: Math.round(ny * 1000) / 1000,
  };
}

export function svgToObstacles(svg, { skipWhite = true, blackOnly = false, mapId = "Map" } = {}) {
  const viewBox = parseViewBox(svg);
  const { flattenTolerance, minAreaSvg } = importOptionsForViewBox(viewBox);
  const shapes = extractShapes(svg, { skipWhite, blackOnly });

  const obstacles = [];
  let skippedSmall = 0;

  for (const shape of shapes) {
    const subpaths =
      shape.kind === "path"
        ? parsePathSubpaths(shape.d, flattenTolerance)
        : parsePolygonPoints(shape.points);

    for (const subpath of subpaths) {
      const areaSvg = polygonAreaSvg(subpath);
      if (areaSvg < minAreaSvg) {
        skippedSmall += 1;
        continue;
      }
      obstacles.push({
        id: `acc-${mapId}-${obstacles.length}`,
        type: "polygon",
        effect: "block",
        source: "accessibility",
        points: subpath.map((p) => svgToMapPct(p.x, p.y, viewBox)),
        areaSvg,
      });
    }
  }

  obstacles.sort((a, b) => b.areaSvg - a.areaSvg);
  for (const obstacle of obstacles) delete obstacle.areaSvg;

  return {
    viewBox,
    obstacles,
    stats: {
      sourceShapes: shapes.length,
      skippedSmall,
    },
    importOptions: { flattenTolerance, minAreaSvg },
  };
}
