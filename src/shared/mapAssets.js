/** Static HLL tactical map image URLs (1920×1920 WebP, no grid). */
export function hllMapImageUrl(mapId) {
  if (!mapId) return null;
  return `/maps/no-grid/${mapId}_NoGrid.webp`;
}

export function hllMapGridUrl() {
  return "/maps/plain-grid.png";
}

export function hllMapStrongpointsUrl(mapId) {
  if (!mapId) return null;
  return `/maps/points/${mapId}_SP_NoMap2.png`;
}
