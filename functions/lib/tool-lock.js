import { isStaffRole } from "./roles.js";

/** Creator, admin, or owner may lock/unlock a tool they can access. */
export function canManageToolLock(steamId, role, createdBy) {
  if (isStaffRole(role)) return true;
  return String(createdBy || "") === String(steamId || "");
}

export function isToolLockOnlyUpdate(updates) {
  const keys = Object.keys(updates || {});
  if (!keys.length) return false;
  return keys.every((key) => key === "locked" || key === "lockedBy");
}

export function assertToolContentEditable(tool, steamId, role, updates) {
  if (!tool?.locked) return { ok: true };

  if (isToolLockOnlyUpdate(updates) && canManageToolLock(steamId, role, tool.createdBy)) {
    return { ok: true };
  }

  return { error: "This item is locked", status: 423 };
}
