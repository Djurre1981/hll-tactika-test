const played = new Set();
const typewriterProgress = new Map();

export function hasPlayedOnce(key) {
  if (!key) return false;
  return played.has(key);
}

export function markPlayedOnce(key) {
  if (!key) return;
  played.add(key);
}

/** In-memory only — cleared on full page reload. */
export function getTypewriterProgress(key) {
  if (!key) return { index: 0, done: false };
  return typewriterProgress.get(key) || { index: 0, done: false };
}

export function setTypewriterProgress(key, index, done) {
  if (!key) return;
  typewriterProgress.set(key, { index, done });
  if (done) played.add(key);
}
