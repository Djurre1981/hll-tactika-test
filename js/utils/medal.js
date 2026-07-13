import { isMedalUrl } from "./video.js";

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

  if (!response.ok) {
    throw new Error("Failed to resolve Medal.tv clip");
  }

  const data = await response.json();
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
