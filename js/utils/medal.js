import { isMedalUrl } from "./video.js";
import { throwIfRateLimited } from "../helpers/rate-limit-ui.js";

const cache = new Map();
const MAX_MEDAL_CACHE = 40;

export async function resolveMedalClip(url, { signal } = {}) {
  if (!isMedalUrl(url)) {
    return null;
  }

  if (cache.has(url)) {
    const cached = cache.get(url);
    cache.delete(url);
    cache.set(url, cached);
    return cached;
  }

  const response = await fetch(`/api/medal/resolve?url=${encodeURIComponent(url)}`, {
    credentials: "same-origin",
    signal,
  });

  const data = await response.json().catch(() => ({}));
  throwIfRateLimited(response, data, "Medal lookup limit reached. Try again shortly.");
  if (!response.ok) {
    throw new Error(data.error || "Failed to resolve Medal.tv clip");
  }

  cache.set(url, data);
  while (cache.size > MAX_MEDAL_CACHE) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  return data;
}

export function clearMedalCache() {
  cache.clear();
}
