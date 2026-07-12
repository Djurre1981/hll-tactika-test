export const PIN_TAGS = new Set(["mg-spot", "climb"]);
export const FACTIONS = new Set(["axis", "allies", "neutral"]);
export const REQUIRES_KEYS = new Set([
  "truck",
  "repair-station",
  "barricade",
  "faction-specific",
]);

export function normalizePinTag(tag) {
  const value = String(tag || "").trim();
  return PIN_TAGS.has(value) ? value : "climb";
}

export function normalizePinFaction(faction) {
  const value = String(faction || "").trim();
  return FACTIONS.has(value) ? value : "neutral";
}

export function sanitizeRequires(requires) {
  if (!requires || typeof requires !== "object" || Array.isArray(requires)) {
    return {};
  }

  const next = {};
  for (const key of REQUIRES_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(requires, key)) {
      continue;
    }
    const value = requires[key];
    if (key === "faction-specific") {
      if (value === true) {
        next[key] = true;
      } else if (typeof value === "string" && FACTIONS.has(value) && value !== "neutral") {
        next[key] = value;
      }
      continue;
    }
    if (value === true) {
      next[key] = true;
    }
  }
  return next;
}
