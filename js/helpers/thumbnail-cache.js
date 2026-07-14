import { clearPinDetailCacheForMap } from "./pin-detail-cache.js";
import { isPreviewStillUrl, pinHasCompactSilentThumbnail } from "./pin-media.js";
import { clearVideoFrameCache } from "../utils/video-frame.js";

const warmedByMap = new Map();
const WARM_CONCURRENCY = 4;

let warmGeneration = 0;

function mapWarmSet(mapId) {
  let set = warmedByMap.get(mapId);
  if (!set) {
    set = new Set();
    warmedByMap.set(mapId, set);
  }
  return set;
}

function preloadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    const done = () => resolve(url);
    img.onload = done;
    img.onerror = done;
    img.src = url;
  });
}

export function dropMapThumbnailCache(mapId) {
  if (!mapId) return;
  warmedByMap.delete(mapId);
  clearPinDetailCacheForMap(mapId);
  clearVideoFrameCache();
}

export function rememberWarmedThumbnail(mapId, url) {
  const thumb = String(url || "").trim();
  if (!mapId || !thumb) return;
  mapWarmSet(mapId).add(thumb);
}

/**
 * Silently warm compact pin thumbnails into the browser image cache.
 * Missing thumbs are not generated here — that stays on first hover.
 */
export async function warmMapThumbnails(mapId, pins) {
  if (!mapId || !Array.isArray(pins) || pins.length === 0) return;

  const generation = ++warmGeneration;
  const warmed = mapWarmSet(mapId);
  const queue = [];

  for (const pin of pins) {
    const thumb = String(pin?.thumbnail || "").trim();
    if (!thumb || !isPreviewStillUrl(thumb)) continue;
    if (!pinHasCompactSilentThumbnail(pin) && Array.isArray(pin?.mediaItems)) {
      continue;
    }
    if (warmed.has(thumb)) continue;
    queue.push(thumb);
  }

  let index = 0;
  async function worker() {
    while (index < queue.length) {
      if (generation !== warmGeneration) return;
      const url = queue[index++];
      if (warmed.has(url)) continue;
      await preloadImage(url);
      if (generation !== warmGeneration) return;
      warmed.add(url);
    }
  }

  const workers = Array.from(
    { length: Math.min(WARM_CONCURRENCY, queue.length) },
    () => worker()
  );
  await Promise.all(workers);
}
