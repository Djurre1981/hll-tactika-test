/** Client-side tool lock helpers (mirror functions/lib/tool-lock.js). */

export function canManageToolLock(role, createdBy, steamId) {
  if (role === "owner" || role === "admin") return true;
  return String(createdBy || "") === String(steamId || "");
}

export function isToolLocked(tool) {
  return Boolean(tool?.locked);
}
