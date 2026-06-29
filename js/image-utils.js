export function isAppImagePath(url) {
  if (!url) return false;
  try {
    const path = url.startsWith("/") ? url.split("?")[0] : new URL(url).pathname;
    return /^\/api\/images\/[0-9a-f-]{36}$/i.test(path);
  } catch {
    return false;
  }
}

export function isDirectImageUrl(url) {
  if (isAppImagePath(url)) {
    return true;
  }
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
}

export function isSupportedThumbnailUrl(url) {
  const normalized = String(url || "").trim();
  if (!normalized) {
    return false;
  }

  if (isAppImagePath(normalized) || isDirectImageUrl(normalized)) {
    return true;
  }

  try {
    const parsed = new URL(normalized, window.location.origin);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function getUnsupportedThumbnailUrlMessage() {
  return "Use a hosted app image (/api/images/…), or a direct JPEG, PNG, WebP, or GIF link.";
}

export const PREVIEW_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";

export const VIDEO_FILE_ACCEPT =
  "video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov,.ogg";
