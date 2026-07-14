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
  // Orphan legacy pins (missing createdBy) are assist/admin/owner only
  return Boolean(steamId) && pin?.createdBy === steamId;
}
