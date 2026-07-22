const cache = new Map();

export const ACCESSIBILITY_VECTOR_VERSION = 2;

export async function loadAccessibilityVectors(mapId) {
  if (cache.has(mapId)) return cache.get(mapId);

  const res = await fetch(`/data/accessibility/${mapId}.vectors.json`, { cache: "no-store" });
  if (!res.ok) return null;

  const data = await res.json();
  cache.set(mapId, data);
  return data;
}

export function clearAccessibilityVectorsCache() {
  cache.clear();
}

/** Merge traced accessibility polygons with user-drawn obstacle edits. */
export function mergeAccessibilityObstacles(vectorPayload, savedObstacles = []) {
  const userObstacles = savedObstacles.filter((o) => o.source === "user");
  const baseObstacles = vectorPayload?.obstacles || [];
  return [...baseObstacles, ...userObstacles];
}

export function needsObstacleVectorUpgrade(savedObstacles = []) {
  if (!savedObstacles.length) return true;
  const accessibility = savedObstacles.filter((o) => o.source === "accessibility");
  if (!accessibility.length) return false;
  return accessibility.some((o) => o.traceVersion !== ACCESSIBILITY_VECTOR_VERSION);
}
