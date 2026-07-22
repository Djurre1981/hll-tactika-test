import { METERS_PER_MAP_PCT } from "../constants.js";
import {
  FRONTIER_WALL_DROP_SEC,
  findWallCrossing,
  isInFrontierAllowedZone,
} from "./frontier-wall.js";
import { pathLengthMeters, travelTimeSec as driveTimeSec } from "./travel-time.js";

function segmentLengthMeters(a, b) {
  const dx = (b.x - a.x) * METERS_PER_MAP_PCT;
  const dy = (b.y - a.y) * METERS_PER_MAP_PCT;
  return Math.hypot(dx, dy);
}

/**
 * Match-clock timing with optional frontier-wall wait at first outward crossing.
 * @param {Array<{x:number,y:number}>} points
 * @param {number} speedKmh
 * @param {"left"|"right"|null|undefined} hqSide
 */
export function computeRouteTiming(points, speedKmh, hqSide) {
  const travelTimeSec = driveTimeSec(points, speedKmh);
  if (!points?.length || points.length < 2 || !hqSide) {
    return {
      travelTimeSec,
      matchArrivalSec: travelTimeSec,
      wallWaitSec: 0,
    };
  }

  const mps = speedKmh / 3.6;
  if (mps <= 0) {
    return { travelTimeSec: 0, matchArrivalSec: 0, wallWaitSec: 0 };
  }

  let matchSec = 0;
  let wallWaitSec = 0;
  let crossedWall = false;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segLenM = segmentLengthMeters(a, b);
    const segDriveSec = segLenM / mps;
    if (segDriveSec <= 0) continue;

    if (!crossedWall) {
      const cross = findWallCrossing(a, b, hqSide);
      if (cross) {
        crossedWall = true;
        const driveToCross = segDriveSec * cross.t;
        const driveAfterCross = segDriveSec * (1 - cross.t);
        const matchAtWall = matchSec + driveToCross;

        if (matchAtWall < FRONTIER_WALL_DROP_SEC) {
          wallWaitSec += FRONTIER_WALL_DROP_SEC - matchAtWall;
          matchSec = FRONTIER_WALL_DROP_SEC + driveAfterCross;
        } else {
          matchSec = matchAtWall + driveAfterCross;
        }
        continue;
      }
    }

    matchSec += segDriveSec;
  }

  return {
    travelTimeSec,
    matchArrivalSec: matchSec,
    wallWaitSec,
  };
}

/**
 * Keyframes for timeline scrubber: [{ t, x, y }] including wait plateau at wall.
 */
export function computeRouteTimeline(points, speedKmh, hqSide) {
  if (!points?.length) return [];
  if (points.length < 2 || !hqSide) {
    return [{ t: 0, x: points[0].x, y: points[0].y }];
  }

  const mps = speedKmh / 3.6;
  if (mps <= 0) {
    return [{ t: 0, x: points[0].x, y: points[0].y }];
  }

  const keyframes = [{ t: 0, x: points[0].x, y: points[0].y }];
  let matchSec = 0;
  let crossedWall = false;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segLenM = segmentLengthMeters(a, b);
    const segDriveSec = segLenM / mps;
    if (segDriveSec <= 0) continue;

    if (!crossedWall) {
      const cross = findWallCrossing(a, b, hqSide);
      if (cross) {
        crossedWall = true;
        const driveToCross = segDriveSec * cross.t;
        const driveAfterCross = segDriveSec * (1 - cross.t);
        const crossPt = { x: cross.x, y: cross.y };
        const matchAtWall = matchSec + driveToCross;

        keyframes.push({ t: matchAtWall, ...crossPt });

        if (matchAtWall < FRONTIER_WALL_DROP_SEC) {
          keyframes.push({ t: FRONTIER_WALL_DROP_SEC, ...crossPt });
          matchSec = FRONTIER_WALL_DROP_SEC + driveAfterCross;
        } else {
          matchSec = matchAtWall + driveAfterCross;
        }

        keyframes.push({ t: matchSec, x: b.x, y: b.y });
        continue;
      }
    }

    matchSec += segDriveSec;
    keyframes.push({ t: matchSec, x: b.x, y: b.y });
  }

  return dedupeTimeline(keyframes);
}

function dedupeTimeline(keyframes) {
  if (!keyframes.length) return keyframes;
  const out = [keyframes[0]];
  for (let i = 1; i < keyframes.length; i++) {
    const prev = out[out.length - 1];
    const cur = keyframes[i];
    if (
      Math.abs(cur.t - prev.t) < 1e-6 &&
      Math.abs(cur.x - prev.x) < 1e-6 &&
      Math.abs(cur.y - prev.y) < 1e-6
    ) {
      continue;
    }
    out.push(cur);
  }
  return out;
}

/** Interpolate vehicle position at match-clock time. */
export function positionAtMatchTime(timeline, matchTimeSec) {
  if (!timeline?.length) return null;
  if (matchTimeSec <= timeline[0].t) {
    return { x: timeline[0].x, y: timeline[0].y };
  }

  for (let i = 1; i < timeline.length; i++) {
    const a = timeline[i - 1];
    const b = timeline[i];
    if (matchTimeSec <= b.t) {
      if (Math.abs(b.t - a.t) < 1e-9) {
        return { x: b.x, y: b.y };
      }
      const u = (matchTimeSec - a.t) / (b.t - a.t);
      return {
        x: a.x + u * (b.x - a.x),
        y: a.y + u * (b.y - a.y),
      };
    }
  }

  const last = timeline[timeline.length - 1];
  return { x: last.x, y: last.y };
}

export function formatMatchTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Max match arrival across routes (for timeline scrubber range). */
export function maxMatchArrivalSec(routes) {
  let max = 0;
  for (const route of routes || []) {
    const t = route.matchArrivalSec;
    if (typeof t === "number" && t > max) max = t;
  }
  return max;
}

/**
 * Enrich route with timing fields from polyline + speed + hqSide.
 */
export function enrichRouteTiming(route, speedKmh, hqSide) {
  const points = route?.points;
  const timing = computeRouteTiming(points, speedKmh, hqSide);
  return {
    ...route,
    travelTimeSec: timing.travelTimeSec,
    matchArrivalSec: timing.matchArrivalSec,
    wallWaitSec: timing.wallWaitSec,
  };
}

/** True when route leaves allowed zone before wall drop (needs wait in ETA). */
export function routeCrossesFrontierWall(points, hqSide) {
  if (!points?.length || points.length < 2 || !hqSide) return false;
  if (isInFrontierAllowedZone(points[0], hqSide)) {
    for (let i = 1; i < points.length; i++) {
      if (!isInFrontierAllowedZone(points[i], hqSide)) return true;
      if (findWallCrossing(points[i - 1], points[i], hqSide)) return true;
    }
  }
  return false;
}
