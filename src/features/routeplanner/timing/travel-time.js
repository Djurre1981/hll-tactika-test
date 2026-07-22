import { METERS_PER_MAP_PCT } from "../constants.js";

export function pathLengthMeters(points) {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = (points[i].x - points[i - 1].x) * METERS_PER_MAP_PCT;
    const dy = (points[i].y - points[i - 1].y) * METERS_PER_MAP_PCT;
    total += Math.hypot(dx, dy);
  }
  return total;
}

export function travelTimeSec(points, speedKmh) {
  const mps = speedKmh / 3.6;
  if (mps <= 0) return 0;
  return pathLengthMeters(points) / mps;
}

export function formatTravelTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}
