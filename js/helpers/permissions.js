import { getCurrentUser } from "../api/auth.js";

const EDITOR_ROLES = ["editor", "assist", "admin", "owner"];
const ANY_PIN_ROLES = ["assist", "admin", "owner"];

export function canEnterEditorMode() {
  const user = getCurrentUser();
  return Boolean(user && EDITOR_ROLES.includes(user.role));
}

export function canModifyPin(pin) {
  const user = getCurrentUser();
  if (!user || !pin) return false;
  if (!canEnterEditorMode()) return false;
  if (ANY_PIN_ROLES.includes(user.role)) return true;
  return pin.createdBy === user.steamId;
}
