import { clearPinDetailCacheForMap } from "./pin-detail-cache.js";
import {
  isAppImagePath,
  isPlatformThumbnailUrl,
  isPreviewStillUrl,
  pinHasCompactSilentThumbnail,
} from "./pin-media.js";
import { clearVideoFrameCache } from "../utils/video-frame.js";

/**
 * Live warm entries keep an already-decoded Image (+ blob URL for same-origin
 * /api/images) so hover can paint without re-fetch/re-decode.
 * @typedef {{
 *   sourceUrl: string,
 *   displayUrl: string,
 *   img: HTMLImageElement,
 *   objectUrl: string | null,
 * }} WarmEntry
 */

/** @type {Map<string, Map<string, WarmEntry>>} */
const warmedByMap = new Map();
/** @type {Map<string, number>} */
const mapEpoch = new Map();
/** In-flight warm promises so hover can await a pin that is already queued. */
const inflightByUrl = new Map();

const WARM_CONCURRENCY = 10;
const MAX_WARMED_PER_MAP = 320;
/** Preview tooltip is ~300px wide; match persisted compact thumbs (360). */
const WARM_DISPLAY_MAX_EDGE = 360;
const WARM_DISPLAY_JPEG_QUALITY = 0.82;

let warmGeneration = 0;

function currentEpoch(mapId) {
  return mapEpoch.get(mapId) || 0;
}

function bumpEpoch(mapId) {
  mapEpoch.set(mapId, currentEpoch(mapId) + 1);
}

function mapWarmMap(mapId) {
  let map = warmedByMap.get(mapId);
  if (!map) {
    map = new Map();
    warmedByMap.set(mapId, map);
  }
  return map;
}

export function absoluteThumbUrl(url) {
  const thumb = String(url || "").trim();
  if (!thumb) return "";
  try {
    return new URL(thumb, window.location.href).href;
  } catch {
    return thumb;
  }
}

function revokeEntry(entry) {
  if (entry?.objectUrl) {
    URL.revokeObjectURL(entry.objectUrl);
  }
}

function trimWarmMap(warmed) {
  while (warmed.size > MAX_WARMED_PER_MAP) {
    const oldestKey = warmed.keys().next().value;
    const entry = warmed.get(oldestKey);
    warmed.delete(oldestKey);
    revokeEntry(entry);
  }
}

function isSameOriginUrl(url) {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function loadImageElement(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    const finish = async (ok) => {
      if (!ok || !img.naturalWidth) {
        resolve(null);
        return;
      }
      try {
        if (typeof img.decode === "function") {
          await img.decode();
        }
      } catch {
        /* still usable */
      }
      resolve(img);
    };
    img.onload = () => void finish(true);
    img.onerror = () => void finish(false);
    img.src = src;
  });
}

/**
 * Downscale large /api/images JPEGs so hover matches YouTube mqdefault snappiness.
 * Cross-origin CDN thumbs are left alone (CORS / already small).
 */
async function blobToWarmDisplayUrl(blob) {
  if (typeof createImageBitmap !== "function") {
    return URL.createObjectURL(blob);
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return URL.createObjectURL(blob);
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= WARM_DISPLAY_MAX_EDGE) {
    bitmap.close();
    return URL.createObjectURL(blob);
  }

  const scale = WARM_DISPLAY_MAX_EDGE / longest;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  bitmap.close();

  try {
    bitmap = await createImageBitmap(blob, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "high",
    });
  } catch {
    return URL.createObjectURL(blob);
  }

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return URL.createObjectURL(blob);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const resized = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", WARM_DISPLAY_JPEG_QUALITY);
  });
  return URL.createObjectURL(resized || blob);
}

async function warmFromNetwork(sourceUrl) {
  // Same-origin (esp. /api/images) — fetch with cookies, store memory blob.
  if (isSameOriginUrl(sourceUrl) || isAppImagePath(sourceUrl)) {
    try {
      const response = await fetch(sourceUrl, {
        credentials: "same-origin",
        mode: "same-origin",
      });
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob || blob.size === 0) return null;
      const objectUrl = await blobToWarmDisplayUrl(blob);
      const img = await loadImageElement(objectUrl);
      if (!img) {
        URL.revokeObjectURL(objectUrl);
        return null;
      }
      return {
        sourceUrl,
        displayUrl: objectUrl,
        img,
        objectUrl,
      };
    } catch {
      /* fall through to <img> preload */
    }
  }

  // YouTube / Medal CDN — no CORS for blob fetch; tiny files anyway.
  const img = await loadImageElement(sourceUrl);
  if (!img) return null;
  return {
    sourceUrl,
    displayUrl: sourceUrl,
    img,
    objectUrl: null,
  };
}

/**
 * Warm a single URL into the live cache. Safe to call from hover for late fills.
 * @returns {Promise<WarmEntry | null>}
 */
export function ensureWarmedThumbnail(mapId, url) {
  const sourceUrl = absoluteThumbUrl(url);
  if (!mapId || !sourceUrl) return Promise.resolve(null);

  const warmed = mapWarmMap(mapId);
  const existing = warmed.get(sourceUrl);
  if (existing?.img?.complete && existing.img.naturalWidth > 0) {
    return Promise.resolve(existing);
  }

  const epoch = currentEpoch(mapId);
  const inflightKey = `${mapId}:${sourceUrl}`;
  const pending = inflightByUrl.get(inflightKey);
  if (pending) return pending;

  const promise = warmFromNetwork(sourceUrl)
    .then((entry) => {
      if (!entry) return null;
      if (currentEpoch(mapId) !== epoch) {
        revokeEntry(entry);
        return null;
      }
      const map = mapWarmMap(mapId);
      const previous = map.get(sourceUrl);
      if (previous && previous !== entry) revokeEntry(previous);
      map.set(sourceUrl, entry);
      trimWarmMap(map);
      return entry;
    })
    .finally(() => {
      inflightByUrl.delete(inflightKey);
    });

  inflightByUrl.set(inflightKey, promise);
  return promise;
}

export function dropMapThumbnailCache(mapId) {
  if (!mapId) return;
  bumpEpoch(mapId);
  warmGeneration += 1;
  const warmed = warmedByMap.get(mapId);
  if (warmed) {
    for (const entry of warmed.values()) {
      revokeEntry(entry);
    }
    warmedByMap.delete(mapId);
  }
  for (const key of [...inflightByUrl.keys()]) {
    if (key.startsWith(`${mapId}:`)) inflightByUrl.delete(key);
  }
  clearPinDetailCacheForMap(mapId);
  clearVideoFrameCache();
}

export function rememberWarmedThumbnail(mapId, url) {
  void ensureWarmedThumbnail(mapId, url);
}

export function getWarmedThumbnail(mapId, url) {
  const sourceUrl = absoluteThumbUrl(url);
  if (!mapId || !sourceUrl) return null;
  const entry = warmedByMap.get(mapId)?.get(sourceUrl);
  if (!entry?.img?.complete || !entry.img.naturalWidth) return null;
  return entry;
}

/** True when this URL was successfully warmed into a live decoded Image. */
export function isThumbnailWarmed(mapId, url) {
  return Boolean(getWarmedThumbnail(mapId, url));
}

function warmPriority(url) {
  // Large /api/images need blob downscale most; queue them first on big maps.
  if (isAppImagePath(url) || isSameOriginUrl(url)) return 0;
  if (isPlatformThumbnailUrl(url)) return 1;
  return 2;
}

/**
 * Silently warm compact pin thumbnails into a live in-memory Image cache.
 * Missing thumbs are not generated here — that stays on first hover.
 */
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
