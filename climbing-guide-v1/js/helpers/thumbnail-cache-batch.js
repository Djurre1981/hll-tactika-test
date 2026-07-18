import { absoluteThumbUrl, mapWarmMap, isSameOriginUrl } from "./thumbnail-cache-state.js";
import { ensureWarmedThumbnail } from "./thumbnail-cache-core.js";
import {
  isAppImagePath,
  isPlatformThumbnailUrl,
  isPreviewStillUrl,
  pinHasCompactSilentThumbnail,
} from "./pin-media.js";

const WARM_CONCURRENCY = 10;

let warmGeneration = 0;

function warmPriority(url) {
  if (isAppImagePath(url) || isSameOriginUrl(url)) return 0;
  if (isPlatformThumbnailUrl(url)) return 1;
  return 2;
}

export async function warmMapThumbnails(mapId, pins) {
  if (!mapId || !Array.isArray(pins) || pins.length === 0) return;

  const generation = ++warmGeneration;
  const warmed = mapWarmMap(mapId);
  const queue = [];

  for (const pin of pins) {
    const thumb = String(pin?.thumbnail || "").trim();
    if (!thumb || !isPreviewStillUrl(thumb)) continue;
    if (!pinHasCompactSilentThumbnail(pin) && Array.isArray(pin?.mediaItems)) {
      continue;
    }
    const key = absoluteThumbUrl(thumb);
    if (!key || warmed.has(key)) continue;
    queue.push(key);
  }

  queue.sort((a, b) => warmPriority(a) - warmPriority(b));

  let index = 0;
  async function worker() {
    while (index < queue.length) {
      if (generation !== warmGeneration) return;
      const url = queue[index++];
      if (warmed.has(url)) continue;
      await ensureWarmedThumbnail(mapId, url);
      if (generation !== warmGeneration) return;
    }
  }

  const workers = Array.from(
    { length: Math.min(WARM_CONCURRENCY, Math.max(queue.length, 1)) },
    () => worker()
  );
  await Promise.all(workers);
}
