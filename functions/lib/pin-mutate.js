import {
  normalizePinFaction,
  normalizePinTag,
  sanitizeRequires,
} from "./pin-fields.js";
import { normalizePinTitle } from "./pin-title.js";

/** Apply partial pin fields onto an existing pin. Returns `{ pin }` or `{ error }`. */
export function applyPinUpdates(existing, pin) {
  const updated = { ...existing };

  if (pin.title !== undefined) {
    updated.title = normalizePinTitle(pin.title);
  }
  if (pin.description !== undefined) {
    updated.description = String(pin.description).trim();
  }
  if (pin.tag !== undefined) {
    updated.tag = normalizePinTag(pin.tag);
  }
  if (pin.x !== undefined) {
    updated.x = Number(pin.x);
  }
  if (pin.y !== undefined) {
    updated.y = Number(pin.y);
  }
  if (pin.videoUrl !== undefined) {
    updated.videoUrl = String(pin.videoUrl).trim();
  }
  if (pin.thumbnail !== undefined) {
    const thumbnail = String(pin.thumbnail).trim();
    if (thumbnail) {
      updated.thumbnail = thumbnail;
    } else {
      delete updated.thumbnail;
    }
  }
  if (pin.faction !== undefined) {
    updated.faction = normalizePinFaction(pin.faction);
  }
  if (pin.requires !== undefined) {
    updated.requires = sanitizeRequires(pin.requires);
  }
  if (Array.isArray(pin.mediaItems)) {
    let thumbnailMarked = false;
    const mediaItems = pin.mediaItems
      .map((item) => {
        const url = String(item?.url || "").trim();
        if (!url) return null;
        const next = {
          kind: item?.kind === "image" ? "image" : "video",
          url,
        };
        if (!thumbnailMarked && item?.isThumbnail === true) {
          next.isThumbnail = true;
          thumbnailMarked = true;
        }
        return next;
      })
      .filter(Boolean);
    if (mediaItems.length > 0) {
      updated.mediaItems = mediaItems;
    } else {
      delete updated.mediaItems;
    }
  }
  if (pin.dirX !== undefined) {
    updated.dirX = Number(pin.dirX);
  }
  if (pin.dirY !== undefined) {
    updated.dirY = Number(pin.dirY);
  }
  if (pin.sourceDiscordMessageId !== undefined) {
    const sourceDiscordMessageId = String(pin.sourceDiscordMessageId || "").trim();
    if (sourceDiscordMessageId) {
      updated.sourceDiscordMessageId = sourceDiscordMessageId;
    } else {
      delete updated.sourceDiscordMessageId;
    }
  }

  if (updated.tag === "mg-spot") {
    if (!Number.isFinite(updated.dirX) || !Number.isFinite(updated.dirY)) {
      return { error: "MG spot direction is required" };
    }
    if (updated.dirX === updated.x && updated.dirY === updated.y) {
      return { error: "MG spot direction must differ from the base" };
    }
  } else {
    delete updated.dirX;
    delete updated.dirY;
  }

  if (!updated.title) {
    return { error: "Title is required" };
  }
  if (!Number.isFinite(updated.x) || !Number.isFinite(updated.y)) {
    return { error: "Valid pin coordinates are required" };
  }

  return { pin: updated };
}
