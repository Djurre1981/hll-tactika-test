import {
  isAppVideoPath,
  isSupportedVideoUrl,
  normalizeVideoUrl,
} from "../utils/video.js";

const IMAGE_EXTENSION_RE = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|$)/i;
const APP_IMAGE_PATH_RE = /^\/api\/images\/(\d{17,20}|[0-9a-f-]{36})$/i;

export function isAppImagePath(url) {
  if (!url) return false;
  try {
    const path = url.startsWith("/") ? url.split("?")[0] : new URL(url, window.location.origin).pathname;
    return APP_IMAGE_PATH_RE.test(path);
  } catch {
    return false;
  }
}

export function isDirectImageUrl(url) {
  return isAppImagePath(url) || IMAGE_EXTENSION_RE.test(normalizeVideoUrl(url));
}

/** YouTube / Medal CDN stills are already compact. */
export function isPlatformThumbnailUrl(url) {
  const normalized = normalizeVideoUrl(url);
  if (!normalized) return false;
  try {
    const host = new URL(
      normalized.startsWith("/") ? normalized : normalized,
      typeof window !== "undefined" ? window.location.origin : "https://localhost/"
    ).hostname.replace(/^www\./, "");
    if (host === "img.youtube.com" || host === "i.ytimg.com") return true;
    if (host === "cdn.medal.tv" || host.endsWith(".cdn.medal.tv")) return true;
  } catch {
    return false;
  }
  return false;
}

/** Stills usable in the hover preview (app images, file URLs, YouTube/Medal CDNs). */
export function isPreviewStillUrl(url) {
  const normalized = normalizeVideoUrl(url);
  if (!normalized) return false;
  if (isDirectImageUrl(normalized)) return true;
  return isPlatformThumbnailUrl(normalized);
}

/**
 * True when pin.thumbnail is a preview still that is not the same URL as any
 * stored media item (full images reused as thumbnails count as non-compact).
 * Markers without mediaItems treat an existing still as compact.
 */
export function pinHasCompactSilentThumbnail(pin) {
  const thumb = String(pin?.thumbnail || "").trim();
  if (!isPreviewStillUrl(thumb)) return false;
  if (isPlatformThumbnailUrl(thumb)) return true;
  const normalizedThumb = normalizeVideoUrl(thumb);

  if (Array.isArray(pin?.mediaItems) && pin.mediaItems.length > 0) {
    return !pin.mediaItems.some(
      (item) => normalizeVideoUrl(String(item?.url || "").trim()) === normalizedThumb
    );
  }

  const videoUrl = String(pin?.videoUrl || "").trim();
  if (videoUrl && normalizeVideoUrl(videoUrl) === normalizedThumb) {
    return false;
  }

  return true;
}

export function pinNeedsCompactStill(pin) {
  return !pinHasCompactSilentThumbnail(pin);
}

export function detectMediaKind(url) {
  const normalized = normalizeVideoUrl(url);
  if (!normalized || !isValidMediaUrl(normalized)) {
    return null;
  }
  if (isDirectImageUrl(normalized)) {
    return "image";
  }
  if (isSupportedVideoUrl(normalized)) {
    return "video";
  }
  return null;
}

export function getUnsupportedMediaUrlMessage() {
  return "Use a supported video link (YouTube, Medal.tv, Discord, Vimeo, uploaded video, .mp4) or a direct image URL (.jpg, .png, .webp, etc.).";
}

export function normalizeMediaItem(item) {
  if (!item?.url) return null;
  const url = String(item.url).trim();
  if (!url) return null;
  const kind = detectMediaKind(url) || (item.kind === "image" ? "image" : "video");
  return { kind, url };
}

export function getPinMediaItems(pin) {
  if (Array.isArray(pin?.mediaItems) && pin.mediaItems.length > 0) {
    return pin.mediaItems.map(normalizeMediaItem).filter(Boolean);
  }

  const items = [];
  if (pin?.thumbnail) {
    const url = String(pin.thumbnail).trim();
    const kind = detectMediaKind(url) === "video" ? "video" : "image";
    items.push({ kind, url });
  }
  if (pin?.videoUrl) {
    items.push({ kind: "video", url: String(pin.videoUrl).trim() });
  }
  return items;
}

export function pinHasMedia(pin) {
  if (pin?.hasMedia === true) return true;
  if (pin?.hasMedia === false) return false;
  return getPinMediaItems(pin).length > 0;
}

export function deriveLegacyMediaFields(mediaItems, thumbnailUrl = "") {
  const firstVideo = mediaItems.find((item) => item.kind === "video");
  const firstImage = mediaItems.find((item) => item.kind === "image");
  const explicitThumbnail = String(thumbnailUrl || "").trim();
  let thumbnail;
  if (explicitThumbnail) {
    const normalizedThumb = normalizeVideoUrl(explicitThumbnail);
    const match = mediaItems.find(
      (item) => normalizeVideoUrl(item.url) === normalizedThumb
    );
    thumbnail = match?.url || explicitThumbnail;
  } else {
    thumbnail = firstImage?.url || undefined;
  }
  return {
    videoUrl: firstVideo?.url || "",
    thumbnail,
    mediaItems,
  };
}

export function isValidMediaUrl(url) {
  const normalized = normalizeVideoUrl(url);
  if (!normalized) return false;
  if (isAppImagePath(normalized) || isAppVideoPath(normalized)) {
    return true;
  }
  if (normalized.startsWith("/") && !normalized.startsWith("//")) {
    return false;
  }
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}
