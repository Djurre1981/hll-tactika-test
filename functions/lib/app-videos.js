const VIDEO_ID_PATTERN = /^\d{17,20}$/;

export function isAppVideoPath(url) {
  if (!url) return false;
  const path = toPathname(url);
  return /^\/api\/videos\/\d{17,20}$/.test(path);
}

export function isAppVideoId(videoId) {
  return VIDEO_ID_PATTERN.test(String(videoId || "").trim());
}

export function appVideoUrl(videoId) {
  return `/api/videos/${String(videoId).trim()}`;
}

export function r2ObjectKey(videoId) {
  return `tricks/${String(videoId).trim()}.mp4`;
}

function toPathname(url) {
  try {
    if (url.startsWith("/")) {
      return url.split("?")[0];
    }
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return "";
  }
}
