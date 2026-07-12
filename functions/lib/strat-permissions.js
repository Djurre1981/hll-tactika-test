import { canEnterEditorMode } from "./pin-permissions.js";

const ANY_STRAT_ROLES = ["assist", "admin", "owner"];

export function canModifyStrat(strat, steamId, role) {
  if (!canEnterEditorMode(role)) {
    return false;
  }
  if (ANY_STRAT_ROLES.includes(role)) {
    return true;
  }
  return strat?.createdBy === steamId;
}

export function canDeleteStrat(strat, steamId, role) {
  if (!canEnterEditorMode(role)) {
    return false;
  }
  if (role === "owner" || role === "admin") {
    return true;
  }
  return strat?.createdBy === steamId;
}
