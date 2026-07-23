/** Maps Let Loose measure scale: 190px ≈ 200m (one grid square on a 1920×1920 tac map). */
export const MEASURE_PX_PER_200M = 190;

export const MEASURE_COLOR = "#00ff00";
export const MEASURE_DEFAULT_LINE_METERS = 400;
export const MEASURE_DEFAULT_RADIUS_METERS = 700;

export function metersFromPixelDistance(px) {
  return Math.trunc((100 * Math.max(0, px)) / MEASURE_PX_PER_200M);
}

export function pixelDistanceFromMeters(meters) {
  return (Math.max(0, meters) * MEASURE_PX_PER_200M) / 100;
}

export function mapPctDistancePx(p0, p1, mapSize, span = 140) {
  if (!p0 || !p1 || !mapSize) return 0;
  const safeSpan = span > 0 ? span : 140;
  const dx = ((p1.x - p0.x) / safeSpan) * mapSize;
  const dy = ((p1.y - p0.y) / safeSpan) * mapSize;
  return Math.hypot(dx, dy);
}

export function metersFromMapPoints(p0, p1, mapSize, span = 140) {
  return metersFromPixelDistance(mapPctDistancePx(p0, p1, mapSize, span));
}

export function metersLabel(meters) {
  return `${Math.max(0, Math.trunc(meters))}m`;
}

export function measureDefaultStyle() {
  return {
    color: MEASURE_COLOR,
    size: 5,
    lineType: "dashed",
    endType: "none",
    startCap: "none",
    endCap: "none",
    opacity: 100,
    filled: false,
  };
}

export function measureStyleFromSettings(settings = {}) {
  return {
    ...measureDefaultStyle(),
    color: settings.color || MEASURE_COLOR,
  };
}

export function measureStrokeColor(object) {
  return object?.style?.color || MEASURE_COLOR;
}

export function measureLineDefaultEnd(start, mapSize, span, normalizePoint) {
  const px = pixelDistanceFromMeters(MEASURE_DEFAULT_LINE_METERS);
  const pctDelta = (px / mapSize) * span;
  return normalizePoint({ x: start.x + pctDelta, y: start.y });
}

export function measureRadiusDefaultBox(center, mapSize, span, normalizePoint) {
  const diameterPx = pixelDistanceFromMeters(MEASURE_DEFAULT_RADIUS_METERS);
  const halfPct = (diameterPx / 2 / mapSize) * span;
  return [
    normalizePoint({ x: center.x - halfPct, y: center.y - halfPct }),
    normalizePoint({ x: center.x + halfPct, y: center.y + halfPct }),
  ].filter(Boolean);
}

export function measureRadiusDiameterMeters(points, mapSize, span) {
  if (!points?.[0] || !points?.[1]) return 0;
  const widthPx = mapPctDistancePx(
    { x: points[0].x, y: points[0].y },
    { x: points[1].x, y: points[0].y },
    mapSize,
    span
  );
  const heightPx = mapPctDistancePx(
    { x: points[0].x, y: points[0].y },
    { x: points[0].x, y: points[1].y },
    mapSize,
    span
  );
  return metersFromPixelDistance(Math.max(widthPx, heightPx));
}
