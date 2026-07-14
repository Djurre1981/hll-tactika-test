import { state } from "../state.js";
import {
  fetchPinDetail,
  refreshPinDetailToken,
} from "../api/pins.js";

const detailCache = new Map();

function cacheKey(mapId, pinId) {
  return `${mapId}:${pinId}`;
}

export function updateMarkerToken(mapId, pinId, detailToken) {
  const markers = state.pinCatalog[mapId];
  if (!markers) return;
  const marker = markers.find((item) => item.id === pinId);
  if (marker) {
    marker.detailToken = detailToken;
  }
}

export function cachePinDetail(mapId, pinId, pin) {
  detailCache.set(cacheKey(mapId, pinId), pin);
}

export function getCachedPinDetail(mapId, pinId) {
  return detailCache.get(cacheKey(mapId, pinId)) || null;
}

export function invalidatePinDetail(mapId, pinId) {
  detailCache.delete(cacheKey(mapId, pinId));
}

export function clearPinDetailCacheForMap(mapId) {
  const prefix = `${mapId}:`;
  for (const key of detailCache.keys()) {
    if (key.startsWith(prefix)) {
      detailCache.delete(key);
    }
  }
}

async function fetchDetailWithRefresh(mapId, marker) {
  const pinId = marker.id;
  let token = marker.detailToken;
  if (!token) {
    token = await refreshPinDetailToken(mapId, pinId);
    updateMarkerToken(mapId, pinId, token);
  }

  try {
    return await fetchPinDetail(mapId, pinId, token);
  } catch (error) {
    if (error.status !== 498) {
      throw error;
    }
    token = await refreshPinDetailToken(mapId, pinId);
    updateMarkerToken(mapId, pinId, token);
    return fetchPinDetail(mapId, pinId, token);
  }
}

export async function resolvePinDetail(mapId, marker) {
  const cached = getCachedPinDetail(mapId, marker.id);
  if (cached) {
    return { ...marker, ...cached };
  }

  const detail = await fetchDetailWithRefresh(mapId, marker);
  cachePinDetail(mapId, marker.id, detail);
  return { ...marker, ...detail };
}
