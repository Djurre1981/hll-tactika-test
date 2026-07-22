import { distMapPct } from "./coords.js";
import {
  pointFitsVehicle,
  segmentFitsVehicle,
  vehicleClearanceSampleStepPct,
} from "./vehicle-clearance.js";

export function clearanceSampleStepPct(gridSize) {
  return vehicleClearanceSampleStepPct(gridSize);
}

/** True when the transport truck body fits along segment a→b. */
export function segmentClear(grid, a, b) {
  return segmentFitsVehicle(grid, a, b);
}

export function pointClear(grid, point) {
  return pointFitsVehicle(grid, point);
}

export function validatePath(grid, points) {
  if (!points?.length) return false;
  for (let i = 1; i < points.length; i += 1) {
    if (!segmentClear(grid, points[i - 1], points[i])) return false;
  }
  return true;
}

/** @deprecated Use segmentFitsVehicle — kept for diagnostics. */
export function segmentLengthMapPct(a, b) {
  return distMapPct(a, b);
}
