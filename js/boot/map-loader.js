import { loadMapMarkers } from "../ui/auth-gate.js";
import { state } from "../state.js";
import { assetUrl } from "../helpers/asset-url.js";

const markerLoads = new Map();

export function waitForImage(image) {
  if (image.complete && image.naturalWidth) return Promise.resolve();
  return new Promise((resolve) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", resolve, { once: true });
  });
}

export function resolveImageSrc(imagePath) {
  const path = assetUrl(imagePath);
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, window.location.origin).href;
}

function rememberMarkerLoad(mapId, promise) {
  const tracked = promise
    .then((data) => {
      state.pinCatalog[mapId] = data.pins || [];
      return data;
    })
    .catch((error) => {
      markerLoads.delete(mapId);
      console.error(`Failed to load markers for ${mapId}:`, error);
      state.pinCatalog[mapId] = [];
      return { mapId, pins: [], mapsWithPins: [], error: error.message };
    });
  markerLoads.set(mapId, tracked);
  return tracked;
}

export async function ensureMapMarkers(mapId) {
  if (!markerLoads.has(mapId)) {
    rememberMarkerLoad(mapId, loadMapMarkers(mapId));
  }
  return markerLoads.get(mapId);
}

export function resolveMapWithPins(requestedMapId, markerData) {
  if (markerData.pins?.length) {
    return requestedMapId;
  }
  const mapsWithPins = markerData.mapsWithPins || [];
  if (!mapsWithPins.length) {
    return requestedMapId;
  }
  if (mapsWithPins.includes(markerData.defaultMapId)) {
    return markerData.defaultMapId;
  }
  return mapsWithPins[0];
}
