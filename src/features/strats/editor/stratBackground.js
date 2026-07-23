/** Fixed logical canvas for strat slides (matches HLL tac map assets). */
export const STRAT_CANVAS_SIZE = 1920;

/** Neutral ground layer custom backgrounds are composited onto. */
export const STRAT_GROUND_URL = "/assets/strats/strat-ground-1920.svg";

/** Sentinel value for the map dropdown “Custom image…” option. */
export const STRAT_CUSTOM_MAP_VALUE = "__custom__";

export const STRAT_RASTER_FIT_MODES = ["contain", "cover", "stretch"];
export const STRAT_RASTER_FIT_DEFAULT = "contain";

/** Client-side prep cap before upload (server allows 12 MB). */
export const STRAT_RASTER_MAX_BYTES = 12 * 1024 * 1024;
export const STRAT_RASTER_MAX_DIMENSION = 4096;

export const STRAT_RASTER_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export function normalizeRasterFit(value) {
  return STRAT_RASTER_FIT_MODES.includes(value) ? value : STRAT_RASTER_FIT_DEFAULT;
}

export function slideBackgroundLabel(slide) {
  if (slide?.rasterUrl) return "Custom image";
  return slide?.mapId || "";
}

export function slideThumbUrl(slide) {
  if (slide?.rasterUrl) return slide.rasterUrl;
  if (!slide?.mapId) return null;
  return `/maps/no-grid/${slide.mapId}_NoGrid.webp`;
}
