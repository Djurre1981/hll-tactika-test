/**
 * Vehicle body dimensions for route clearance (from FModel blueprint exports).
 * Minimum passage width = full truck width (JeepBarrier on BP_Ford_Base).
 */
import { METERS_PER_MAP_PCT } from "../constants.js";
import { gridToMapPct, mapPctToGrid, distMapPct } from "./coords.js";
import { isBlocked } from "./accessibility-grid.js";
import { TRANSPORT_TRUCK_BODY_HALF_WIDTH_CM } from "./vehicle-body.js";

/** UE units → cm (Unreal centimeters). */
const UE_CM_PER_M = 100;

export function getTransportBodyHalfWidthM() {
  return TRANSPORT_TRUCK_BODY_HALF_WIDTH_CM / UE_CM_PER_M;
}

/** Full truck width — minimum corridor gap (the green-line stroke width in map QA). */
export function getTransportBodyWidthM() {
  return getTransportBodyHalfWidthM() * 2;
}

export function getTransportBodyHalfWidthMapPct() {
  return getTransportBodyHalfWidthM() / METERS_PER_MAP_PCT;
}

export function getTransportBodyWidthMapPct() {
  return getTransportBodyWidthM() / METERS_PER_MAP_PCT;
}

/** Sample spacing along route segments and across truck width. */
export function vehicleClearanceSampleStepPct(gridSize) {
  const cellSpan = 100 / gridSize;
  const halfW = getTransportBodyHalfWidthMapPct();
  return Math.min(cellSpan * 0.45, halfW / 4);
}

/**
 * True when a truck centered at map point fits (disk of half-width clears obstacles).
 */
export function pointFitsVehicle(grid, point) {
  const halfW = getTransportBodyHalfWidthMapPct();
  const step = vehicleClearanceSampleStepPct(grid.gridSize);

  const samples = [{ x: point.x, y: point.y }];
  const ringCount = Math.max(8, Math.ceil((Math.PI * halfW) / step));
  for (let i = 0; i < ringCount; i += 1) {
    const angle = (2 * Math.PI * i) / ringCount;
    samples.push({
      x: point.x + Math.cos(angle) * halfW,
      y: point.y + Math.sin(angle) * halfW,
    });
  }

  for (const p of samples) {
    const { gx, gy } = mapPctToGrid(p.x, p.y, grid.gridSize);
    if (isBlocked(grid, gx, gy)) return false;
  }
  return true;
}

/** Grid cell center must fit a truck (pathfinding node test). */
export function isVehicleCellBlocked(grid, gx, gy) {
  const center = gridToMapPct(gx, gy, grid.gridSize);
  return !pointFitsVehicle(grid, center);
}

/**
 * True when the full truck body fits along segment a→b (capsule of width = truck width).
 * Perpendicular span matches the green-line minimum-width reference.
 */
export function segmentFitsVehicle(grid, a, b) {
  const halfW = getTransportBodyHalfWidthMapPct();
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = distMapPct(a, b);
  if (len === 0) return pointFitsVehicle(grid, a);

  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const stepAlong = vehicleClearanceSampleStepPct(grid.gridSize);
  const steps = Math.max(2, Math.ceil(len / stepAlong));
  const widthSteps = Math.max(2, Math.ceil((halfW * 2) / stepAlong));

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const cx = a.x + dx * t;
    const cy = a.y + dy * t;
    for (let w = 0; w <= widthSteps; w += 1) {
      const u = -halfW + (halfW * 2 * w) / widthSteps;
      const sample = { x: cx + px * u, y: cy + py * u };
      const { gx, gy } = mapPctToGrid(sample.x, sample.y, grid.gridSize);
      if (isBlocked(grid, gx, gy)) return false;
    }
  }
  return true;
}
