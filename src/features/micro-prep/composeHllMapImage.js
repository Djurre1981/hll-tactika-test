import {
  hllMapGridUrl,
  hllMapImageUrl,
  hllMapStrongpointsUrl,
} from "../../shared/mapAssets.js";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Bake base map + optional grid / strongpoint overlays into one PNG data URL.
 * Matches Strat map-kernel overlay stacking order.
 */
export async function composeHllMapDataUrl(mapId, { showGrid = false, showStrongpoints = false } = {}) {
  const base = await loadImage(hllMapImageUrl(mapId));
  const width = base.naturalWidth || 1920;
  const height = base.naturalHeight || 1920;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  ctx.drawImage(base, 0, 0, width, height);

  if (showGrid) {
    const grid = await loadImage(hllMapGridUrl());
    ctx.drawImage(grid, 0, 0, width, height);
  }

  if (showStrongpoints) {
    const spUrl = hllMapStrongpointsUrl(mapId);
    try {
      const sp = await loadImage(spUrl);
      ctx.drawImage(sp, 0, 0, width, height);
    } catch {
      /* Some maps may lack a strongpoint asset — keep base (+ grid). */
    }
  }

  return canvas.toDataURL("image/png");
}
