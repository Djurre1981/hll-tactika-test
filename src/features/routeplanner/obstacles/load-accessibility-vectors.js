const cache = new Map();

export const ACCESSIBILITY_VECTOR_VERSION = 10;

/** Identifies a specific vectors.json build (regenerating the file changes this). */
export function vectorBuildId(vectorPayload) {
  if (!vectorPayload) return "";
  return [
    vectorPayload.version ?? 0,
    vectorPayload.traceMode ?? "",
    vectorPayload.obstacleCount ?? 0,
    vectorPayload.stats?.vertices ?? 0,
    vectorPayload.rdpEpsilonPx ?? "",
  ].join(":");
}

export async function loadAccessibilityVectors(mapId, { bustCache = false } = {}) {
  if (bustCache) cache.delete(mapId);
  if (cache.has(mapId)) return cache.get(mapId);

  const res = await fetch(
    `/data/accessibility/${mapId}.vectors.json?v=${ACCESSIBILITY_VECTOR_VERSION}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;

  const data = await res.json();
  cache.set(mapId, data);
  return data;
}

export function clearAccessibilityVectorsCache() {
  cache.clear();
}

/** Import traced vectors as the editable obstacle layer (single source of truth). */
export function importVectorObstacles(vectorPayload) {
  const buildId = vectorBuildId(vectorPayload);
  return (vectorPayload?.obstacles || []).map((o) => ({
    ...o,
    source: "layer",
    vectorBuildId: buildId,
    traceVersion: ACCESSIBILITY_VECTOR_VERSION,
  }));
}

/** Merge traced accessibility polygons with saved edits — only for initial load / vector rebuild. */
export function mergeAccessibilityObstacles(vectorPayload, savedObstacles = [], savedBuildId = null) {
  const buildId = vectorBuildId(vectorPayload);
  const imported = importVectorObstacles(vectorPayload);

  if (!savedObstacles.length) return imported;

  const expectedBuildId = buildId;
  if (savedBuildId && savedBuildId !== expectedBuildId) {
    const userAdded = savedObstacles.filter((o) => o.source === "user");
    return [...imported, ...userAdded.map((o) => ({ ...o, source: "layer" }))];
  }

  const userObstacles = savedObstacles.filter((o) => o.source === "user");
  if (userObstacles.length) {
    return [...imported, ...userObstacles.map((o) => ({ ...o, source: "layer" }))];
  }

  return imported;
}

export function needsObstacleVectorUpgrade(
  savedObstacles = [],
  vectorPayload = null,
  savedBuildId = null
) {
  if (!vectorPayload?.obstacles?.length) return false;

  const expectedBuildId = vectorBuildId(vectorPayload);

  if (!savedObstacles.length) return true;

  if (savedBuildId === expectedBuildId) return false;

  if (!savedBuildId) {
    const accessibility = savedObstacles.filter((o) => o.source === "accessibility");
    if (!accessibility.length) {
      return false;
    }
    return accessibility.some(
      (o) =>
        o.vectorBuildId !== expectedBuildId ||
        o.traceVersion !== ACCESSIBILITY_VECTOR_VERSION
    );
  }

  return savedBuildId !== expectedBuildId;
}

/** True when accessibility vectors differ from what is currently loaded. */
export function accessibilityObstaclesDiffer(savedObstacles = [], vectorPayload = null, savedBuildId = null) {
  if (!vectorPayload?.obstacles?.length) return false;
  return needsObstacleVectorUpgrade(savedObstacles, vectorPayload, savedBuildId);
}

/** Keep traced + drawn shapes on one editable layer. */
export function normalizeLayerObstacles(obstacles = []) {
  return obstacles.map((o) => ({
    ...o,
    source: "layer",
  }));
}
