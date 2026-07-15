const EDITOR_ROLES = ["editor", "assist", "admin", "owner"];
const ANY_PIN_ROLES = ["assist", "admin", "owner"];

export function canEnterEditorMode(role) {
  return EDITOR_ROLES.includes(role);
}

export function canModifyPin(pin, steamId, role) {
  if (!canEnterEditorMode(role)) {
    return false;
  }
  if (ANY_PIN_ROLES.includes(role)) {
    return true;
  }
  // Orphan/seed pins (missing createdBy) are assist/admin/owner only
  if (!pin?.createdBy || !steamId) return false;
  return String(pin.createdBy) === String(steamId);
}
