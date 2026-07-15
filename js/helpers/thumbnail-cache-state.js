import { clearPinDetailCacheForMap } from "./pin-detail-cache.js";
import { clearVideoFrameCache } from "../utils/video-frame.js";

const warmedByMap = new Map();
const mapEpoch = new Map();
export const inflightByUrl = new Map();

let warmGeneration = 0;

export function currentEpoch(mapId) {
  return mapEpoch.get(mapId) || 0;
}

export function bumpEpoch(mapId) {
  mapEpoch.set(mapId, currentEpoch(mapId) + 1);
}

export function mapWarmMap(mapId) {
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

export function revokeEntry(entry) {
  if (entry?.objectUrl) {
    URL.revokeObjectURL(entry.objectUrl);
  }
}

export function trimWarmMap(warmed) {
  while (warmed.size > 320) {
    const oldestKey = warmed.keys().next().value;
    const entry = warmed.get(oldestKey);
    warmed.delete(oldestKey);
    revokeEntry(entry);
  }
}

export function isSameOriginUrl(url) {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
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

export function getWarmedThumbnail(mapId, url) {
  const sourceUrl = absoluteThumbUrl(url);
  if (!mapId || !sourceUrl) return null;
  const entry = warmedByMap.get(mapId)?.get(sourceUrl);
  if (!entry?.img?.complete || !entry.img.naturalWidth) return null;
  return entry;
}

export function isThumbnailWarmed(mapId, url) {
  return Boolean(getWarmedThumbnail(mapId, url));
}
