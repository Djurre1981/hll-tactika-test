const cache = new Map();

function gridVersionKey(mapId, data) {
  return `${mapId}:${data.paddingCells}:${data.blocked.length}`;
}

export async function loadAccessibilityGrid(mapId) {
  const res = await fetch(`/data/accessibility/${mapId}.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Accessibility data missing for ${mapId}`);
  const data = await res.json();
  const versionKey = gridVersionKey(mapId, data);
  if (cache.has(versionKey)) return cache.get(versionKey);

  for (const key of cache.keys()) {
    if (key.startsWith(`${mapId}:`)) cache.delete(key);
  }

  const blocked = new Uint8Array(data.gridSize * data.gridSize);
  for (let i = 0; i < data.blocked.length; i++) {
    blocked[i] = data.blocked[i] === "1" ? 1 : 0;
  }
  const grid = { ...data, blocked };
  cache.set(versionKey, grid);
  return grid;
}

export function isBlocked(grid, gx, gy) {
  if (gx < 0 || gy < 0 || gx >= grid.gridSize || gy >= grid.gridSize) return true;
  return grid.blocked[gy * grid.gridSize + gx] === 1;
}

export function segmentCrossesBlocked(grid, a, b, sampleStep = 0.4) {
  const steps = Math.max(2, Math.ceil(dist(a, b) / sampleStep));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const gx = Math.floor(a.gx + (b.gx - a.gx) * t);
    const gy = Math.floor(a.gy + (b.gy - a.gy) * t);
    if (isBlocked(grid, gx, gy)) return true;
  }
  return false;
}

function dist(a, b) {
  return Math.hypot(b.gx - a.gx, b.gy - a.gy);
}
