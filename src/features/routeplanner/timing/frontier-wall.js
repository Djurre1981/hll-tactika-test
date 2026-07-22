/** Match start frontier wall drops at 120s (game rule). */
export const FRONTIER_WALL_DROP_SEC = 120;

/** Tactical map grid is 10×10 (A–J / 1–10) → 10 map-% per square on 0–100% coords. */
export const MAP_PCT_PER_GRID_SQUARE = 10;

/** Two grid squares from HQ side, then wall on the next border. */
export const FRONTIER_WALL_SQUARES_FROM_HQ = 2;

/** Allies (left HQ): columns A+B open; wall on B/C border (e.g. Carentan US). */
export const WALL_LINE_LEFT_HQ = MAP_PCT_PER_GRID_SQUARE * FRONTIER_WALL_SQUARES_FROM_HQ;

/** Axis (right HQ): columns I+J open; wall on H/I border (e.g. Carentan GER). */
export const WALL_LINE_RIGHT_HQ = MAP_PCT_PER_GRID_SQUARE * (10 - FRONTIER_WALL_SQUARES_FROM_HQ);

/**
 * @param {"left"|"right"|string|null|undefined} hqSide
 * @returns {{ axis: "x", value: number, hqSide: string } | null}
 */
export function getFrontierWallLine(hqSide) {
  if (hqSide === "left") {
    return { axis: "x", value: WALL_LINE_LEFT_HQ, hqSide: "left" };
  }
  if (hqSide === "right") {
    return { axis: "x", value: WALL_LINE_RIGHT_HQ, hqSide: "right" };
  }
  return null;
}

/**
 * Whether a point is in the HQ-side zone allowed during the first 120s.
 * @param {{ x: number, y: number }} point
 * @param {"left"|"right"|string|null|undefined} hqSide
 */
export function isInFrontierAllowedZone(point, hqSide) {
  if (!point || hqSide == null) return true;
  if (hqSide === "left") return point.x < WALL_LINE_LEFT_HQ;
  if (hqSide === "right") return point.x >= WALL_LINE_RIGHT_HQ;
  return true;
}

/**
 * First outward crossing from allowed → blocked half-plane along segment A→B.
 * @returns {{ t: number, x: number, y: number } | null} t ∈ (0, 1] along segment
 */
export function findWallCrossing(a, b, hqSide) {
  if (!a || !b || hqSide == null) return null;

  const x1 = a.x;
  const x2 = b.x;
  const dx = x2 - x1;

  if (hqSide === "left") {
    if (x1 >= WALL_LINE_LEFT_HQ || x2 < WALL_LINE_LEFT_HQ) return null;
    if (Math.abs(dx) < 1e-9) return { t: 0, x: WALL_LINE_LEFT_HQ, y: a.y };
    const t = (WALL_LINE_LEFT_HQ - x1) / dx;
    if (t <= 0 || t > 1) return null;
    return { t, x: WALL_LINE_LEFT_HQ, y: a.y + t * (b.y - a.y) };
  }

  if (hqSide === "right") {
    if (x1 < WALL_LINE_RIGHT_HQ || x2 >= WALL_LINE_RIGHT_HQ) return null;
    if (Math.abs(dx) < 1e-9) return { t: 0, x: WALL_LINE_RIGHT_HQ, y: a.y };
    const t = (WALL_LINE_RIGHT_HQ - x1) / dx;
    if (t <= 0 || t > 1) return null;
    return { t, x: WALL_LINE_RIGHT_HQ, y: a.y + t * (b.y - a.y) };
  }

  return null;
}

/**
 * @param {object|null} hqSpawnsJson
 * @param {string} mapId
 * @param {string} factionId
 * @returns {"left"|"right"|null}
 */
export function getHqSideFromData(hqSpawnsJson, mapId, factionId) {
  return hqSpawnsJson?.maps?.[mapId]?.factions?.[factionId]?.hqSide ?? null;
}
