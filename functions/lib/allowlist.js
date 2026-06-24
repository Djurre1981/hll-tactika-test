export {
  getAdminSteamIds,
  getUserSteamIds,
  getUserRole,
  isAllowedSteamId,
  isAdmin,
} from "./roles.js";

import { getAdminSteamIds, getUserSteamIds } from "./roles.js";

/** @deprecated Use getAdminSteamIds / getUserSteamIds */
export function getAllowedSteamIds(env) {
  return [...new Set([...getAdminSteamIds(env), ...getUserSteamIds(env)])];
}
