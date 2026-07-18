export const LERP_FACTOR = 0.12;
export const SNAP_THRESHOLD = 0.001;
export const SEEK_THROTTLE_MS = 30;
export const ACTIVATE_RETRY_MS = 500;
export const LOAD_TIMEOUT_MS = 15000;

export function resolveSourceUrl(sourceUrl) {
  if (!sourceUrl) return "";
  if (/^https?:\/\//i.test(sourceUrl)) return sourceUrl;
  const path = sourceUrl.startsWith("/") ? sourceUrl : `/${sourceUrl}`;
  return new URL(path, window.location.origin).href;
}

export function hasValidDuration(video) {
  return Number.isFinite(video.duration) && video.duration > 0;
}

export function hasFrameData(video) {
  return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
}

export function isFullyBuffered(video) {
  if (!hasValidDuration(video)) return false;
  for (let i = 0; i < video.buffered.length; i++) {
    if (video.buffered.start(i) <= 0.05 && video.buffered.end(i) >= video.duration - 0.05) {
      return true;
    }
  }
  return false;
}
