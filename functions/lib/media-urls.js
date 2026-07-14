import { isAppImagePath, isAppVideoPath } from "./app-media.js";
import {
  getHostname,
  isDiscordMediaUrl,
  isSafeHttpUrl,
  parseMediaUrl,
} from "./discord-url.js";

const YOUTUBE_HOSTS = ["youtube.com", "youtu.be", "www.youtube.com", "m.youtube.com"];
const VIMEO_HOSTS = ["vimeo.com", "www.vimeo.com", "player.vimeo.com"];

export function isDirectVideoUrl(url) {
  if (isAppVideoPath(url)) {
    return true;
  }
  if (!isSafeHttpUrl(url)) {
    return false;
  }
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

export function isDirectImageUrl(url) {
  if (isAppImagePath(url)) {
    return true;
  }
  if (!isSafeHttpUrl(url)) {
    return false;
  }
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
}

export function pinHasDirectPlayableVideo(pin) {
  const videoUrl = String(pin?.videoUrl || "").trim();
  if (videoUrl && isDirectVideoUrl(videoUrl)) {
    return true;
  }
  if (!Array.isArray(pin?.mediaItems)) {
    return false;
  }
  return pin.mediaItems.some((item) => {
    const url = String(item?.url || "").trim();
    if (!url) return false;
    if (item?.kind === "image") return false;
    return isDirectVideoUrl(url);
  });
}

/** True for app images, extensioned URLs, and known YouTube/Medal thumbnail CDNs. */
export function isPersistableThumbnailUrl(url) {
  const normalized = String(url || "").trim();
  if (!normalized) {
    return false;
  }
  if (isDirectImageUrl(normalized)) {
    return true;
  }
  if (!isSafeHttpUrl(normalized)) {
    return false;
  }
  const hostname = getHostname(normalized);
  if (hostname === "img.youtube.com" || hostname === "i.ytimg.com") {
    return true;
  }
  if (hostname === "cdn.medal.tv" || hostname.endsWith(".cdn.medal.tv")) {
    return true;
  }
  return false;
}

export function pinHasImageThumbnail(pin) {
  return isPersistableThumbnailUrl(String(pin?.thumbnail || "").trim());
}

/** YouTube / Medal CDN stills are already compact. */
export function isPlatformThumbnailUrl(url) {
  const normalized = String(url || "").trim();
  if (!normalized || !isSafeHttpUrl(normalized)) {
    return false;
  }
  const hostname = getHostname(normalized);
  if (hostname === "img.youtube.com" || hostname === "i.ytimg.com") {
    return true;
  }
  if (hostname === "cdn.medal.tv" || hostname.endsWith(".cdn.medal.tv")) {
    return true;
  }
  return false;
}

function pinMediaUrls(pin) {
  const urls = [];
  if (Array.isArray(pin?.mediaItems)) {
    for (const item of pin.mediaItems) {
      const url = String(item?.url || "").trim();
      if (url) urls.push(url);
    }
  }
  const videoUrl = String(pin?.videoUrl || "").trim();
  if (videoUrl) urls.push(videoUrl);
  return urls;
}

/**
 * True when pin.thumbnail is a persistable still that is not the same URL as
 * any media item (full images reused as thumbnails count as non-compact).
 */
export function pinHasCompactSilentThumbnail(pin) {
  const thumb = String(pin?.thumbnail || "").trim();
  if (!isPersistableThumbnailUrl(thumb)) {
    return false;
  }
  if (isPlatformThumbnailUrl(thumb)) {
    return true;
  }
  return !pinMediaUrls(pin).some((url) => url === thumb);
}

export function pinHasSupportedMedia(pin) {
  return pinHasSupportedVideo(pin) || pinHasDirectImage(pin);
}

export function pinHasDirectImage(pin) {
  if (Array.isArray(pin?.mediaItems)) {
    for (const item of pin.mediaItems) {
      const url = String(item?.url || "").trim();
      if (!url) continue;
      if (item?.kind === "image" || isDirectImageUrl(url)) {
        return true;
      }
    }
  }
  return isDirectImageUrl(String(pin?.thumbnail || "").trim());
}

export function pinHasSupportedVideo(pin) {
  const videoUrl = String(pin?.videoUrl || "").trim();
  if (videoUrl && isSupportedHostedVideoUrl(videoUrl)) {
    return true;
  }
  if (!Array.isArray(pin?.mediaItems)) {
    return false;
  }
  return pin.mediaItems.some((item) => {
    const url = String(item?.url || "").trim();
    if (!url) return false;
    if (item?.kind === "image") return false;
    return isSupportedHostedVideoUrl(url);
  });
}

export function isSupportedHostedVideoUrl(url) {
  const normalized = String(url || "").trim();
  if (!normalized) {
    return false;
  }

  if (isAppVideoPath(normalized)) {
    return true;
  }

  if (!isSafeHttpUrl(normalized)) {
    return false;
  }

  const hostname = getHostname(normalized);

  if (hostname === "medal.tv") {
    return true;
  }

  if (YOUTUBE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
    return true;
  }

  if (VIMEO_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
    return true;
  }

  if (isDiscordMediaUrl(normalized)) {
    return true;
  }

  return isDirectVideoUrl(normalized);
}

export function isSupportedThumbnailUrl(url) {
  const normalized = String(url || "").trim();
  if (!normalized) {
    return false;
  }

  if (isAppImagePath(normalized)) {
    return true;
  }

  if (isDirectImageUrl(normalized)) {
    return true;
  }

  return isSafeHttpUrl(normalized);
}

export function validatePinMediaFields(pin) {
  const videoUrl = String(pin.videoUrl || "").trim();
  if (videoUrl && !isSupportedHostedVideoUrl(videoUrl)) {
    return { error: "Unsupported video URL" };
  }

  const thumbnail = String(pin.thumbnail || "").trim();
  if (thumbnail && !isSupportedThumbnailUrl(thumbnail)) {
    return { error: "Unsupported preview image URL" };
  }

  if (Array.isArray(pin.mediaItems)) {
    for (const item of pin.mediaItems) {
      const url = String(item?.url || "").trim();
      if (!url) continue;
      const kind = item?.kind === "image" ? "image" : "video";
      if (kind === "image" && !isSupportedThumbnailUrl(url)) {
        return { error: "Unsupported image URL in media items" };
      }
      if (kind === "video" && !isSupportedHostedVideoUrl(url)) {
        return { error: "Unsupported video URL in media items" };
      }
    }
  }

  return null;
}

export { parseMediaUrl };
