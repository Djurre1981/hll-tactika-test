import { getCurrentUser } from "../api/auth.js";

export function canModifyPin(pin) {
  const user = getCurrentUser();
  if (!user || !pin) return false;
  if (user.role === "admin" || user.role === "owner") return true;
  return pin.createdBy === user.steamId;
}
