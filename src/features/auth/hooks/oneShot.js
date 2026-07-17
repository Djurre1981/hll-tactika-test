const memory = new Set();

export function hasPlayedOnce(key) {
  if (!key) return false;
  if (memory.has(key)) return true;
  try {
    return sessionStorage.getItem(key) === "done";
  } catch {
    return false;
  }
}

export function markPlayedOnce(key) {
  if (!key) return;
  memory.add(key);
  try {
    sessionStorage.setItem(key, "done");
  } catch {
    // ignore quota / private mode
  }
}
