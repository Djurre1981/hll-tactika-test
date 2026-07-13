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

export function pinHasStoredMedia(pin) {
  if (!pin) return false;
  if (String(pin.videoUrl || "").trim()) return true;
  if (String(pin.thumbnail || "").trim()) return true;
  if (Array.isArray(pin.mediaItems) && pin.mediaItems.length > 0) return true;
  return false;
}

export function toPinMarker(pin, detailToken) {
  const marker = {
    id: pin.id,
    title: pin.title,
    tag: pin.tag,
    x: pin.x,
    y: pin.y,
    faction: pin.faction,
    requires: pin.requires || {},
    detailToken,
    hasMedia: pinHasStoredMedia(pin),
  };

  const thumbnail = String(pin.thumbnail || "").trim();
  if (thumbnail) {
    marker.thumbnail = thumbnail;
  }

  if (pin.tag === "mg-spot") {
    const dirX = Number(pin.dirX);
    const dirY = Number(pin.dirY);
    if (Number.isFinite(dirX) && Number.isFinite(dirY)) {
      marker.dirX = dirX;
      marker.dirY = dirY;
    }
  }

  return marker;
}

export function toPinDetail(pin) {
  return structuredClone(pin);
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
