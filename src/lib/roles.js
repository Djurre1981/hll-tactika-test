/** Client-side role helpers (mirror server editor/staff gates). */

export const EDITOR_ROLES = ["editor", "assist", "admin", "owner"];
export const STAFF_ROLES = ["admin", "owner"];

export function canEnterEditorMode(role) {
  return EDITOR_ROLES.includes(role);
}

export function canEditEvents(role) {
  return canEnterEditorMode(role);
}

export function canEditStrats(role) {
  return canEnterEditorMode(role);
}

export function canManageTeam(role) {
  return STAFF_ROLES.includes(role);
}

export function canViewTeam(role) {
  return canManageTeam(role);
}
