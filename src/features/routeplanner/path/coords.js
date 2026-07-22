import { MAP_PCT_MAX, MAP_PCT_MIN } from "../constants.js";

export function mapPctToGrid(x, y, gridSize) {
  const span = MAP_PCT_MAX - MAP_PCT_MIN;
  const gx = Math.floor(((x - MAP_PCT_MIN) / span) * gridSize);
  const gy = Math.floor(((y - MAP_PCT_MIN) / span) * gridSize);
  return {
    gx: Math.min(gridSize - 1, Math.max(0, gx)),
    gy: Math.min(gridSize - 1, Math.max(0, gy)),
  };
}

export function gridToMapPct(gx, gy, gridSize) {
  const span = MAP_PCT_MAX - MAP_PCT_MIN;
  return {
    x: MAP_PCT_MIN + ((gx + 0.5) / gridSize) * span,
    y: MAP_PCT_MIN + ((gy + 0.5) / gridSize) * span,
  };
}

export function distMapPct(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
