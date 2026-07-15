import {
  absoluteThumbUrl,
  currentEpoch,
  mapWarmMap,
  revokeEntry,
  trimWarmMap,
  isSameOriginUrl,
  inflightByUrl,
} from "./thumbnail-cache-state.js";
import { isAppImagePath } from "./pin-media.js";

const WARM_DISPLAY_MAX_EDGE = 360;
const WARM_DISPLAY_JPEG_QUALITY = 0.82;

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

  const img = await loadImageElement(sourceUrl);
  if (!img) return null;
  return {
    sourceUrl,
    displayUrl: sourceUrl,
    img,
    objectUrl: null,
  };
}

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

export function rememberWarmedThumbnail(mapId, url) {
  void ensureWarmedThumbnail(mapId, url);
}
