import {
  isSupportedVideoUrl,
  normalizeVideoUrl,
} from "../utils/video.js";

const IMAGE_EXTENSION_RE = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|$)/i;

export function isDirectImageUrl(url) {
  return IMAGE_EXTENSION_RE.test(normalizeVideoUrl(url));
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
  return "Use a supported video link (YouTube, Medal.tv, Discord, Vimeo, .mp4) or a direct image URL (.jpg, .png, .webp, etc.).";
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
    items.push({ kind: "image", url: String(pin.thumbnail).trim() });
  }
  if (pin?.videoUrl) {
    items.push({ kind: "video", url: String(pin.videoUrl).trim() });
  }
  return items;
}

export function pinHasMedia(pin) {
  return getPinMediaItems(pin).length > 0;
}

export function deriveLegacyMediaFields(mediaItems) {
  const firstVideo = mediaItems.find((item) => item.kind === "video");
  const firstImage = mediaItems.find((item) => item.kind === "image");
  return {
    videoUrl: firstVideo?.url || "",
    thumbnail: firstImage?.url || undefined,
    mediaItems,
  };
}

export function isValidMediaUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
