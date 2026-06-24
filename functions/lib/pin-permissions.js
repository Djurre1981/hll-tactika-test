export function canModifyPin(pin, steamId, role) {
  if (role === "admin") {
    return true;
  }
  if (role === "user") {
    return pin?.createdBy === steamId;
  }
  return false;
}
