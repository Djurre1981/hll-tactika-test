import { isAppImagePath, isAppVideoPath } from "./app-media.js";
import {
  getHostname,
  isDiscordMediaUrl,
  isSafeHttpUrl,
  parseMediaUrl,
} from "./discord-url.js";

const YOUTUBE_HOSTS = ["youtube.com", "youtu.be", "www.youtube.com", "m.youtube.com"];
const VIMEO_HOSTS = ["vimeo.com", "www.vimeo.com", "player.vimeo.com"];

function isDirectVideoUrl(url) {
  if (isAppVideoPath(url)) {
    return true;
  }
  if (!isSafeHttpUrl(url)) {
    return false;
  }
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

function isDirectImageUrl(url) {
  if (isAppImagePath(url)) {
    return true;
  }
  if (!isSafeHttpUrl(url)) {
    return false;
  }
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
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
