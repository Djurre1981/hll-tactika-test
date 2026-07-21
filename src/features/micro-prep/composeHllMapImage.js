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

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas export failed"));
      },
      type,
      quality
    );
  });
}

async function composeHllMapCanvas(mapId, { showGrid = false, showStrongpoints = false } = {}) {
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

  return canvas;
}

/**
 * Bake base map + optional grid / strongpoint overlays into a JPEG blob.
 * PNG at 4096² exceeds the 12 MB upload cap; JPEG keeps quality while fitting R2.
 */
export async function composeHllMapBlob(
  mapId,
  { showGrid = false, showStrongpoints = false, quality = 0.88 } = {}
) {
  const canvas = await composeHllMapCanvas(mapId, { showGrid, showStrongpoints });
  return canvasToBlob(canvas, "image/jpeg", quality);
}

/** @deprecated Prefer composeHllMapBlob for uploads — PNG data URLs are too large at map resolution. */
export async function composeHllMapDataUrl(mapId, options = {}) {
  const canvas = await composeHllMapCanvas(mapId, options);
  return canvas.toDataURL("image/jpeg", options.quality ?? 0.88);
}
