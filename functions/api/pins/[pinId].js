import { requireAuth } from "../../lib/auth-request.js";
import { mirrorPinMedia } from "../../lib/discord-ingest.js";
import { validatePinMediaFields } from "../../lib/media-urls.js";
import {
  normalizePinFaction,
  normalizePinTag,
  sanitizeRequires,
} from "../../lib/pin-fields.js";
import { canEnterEditorMode, canModifyPin } from "../../lib/pin-permissions.js";
import { findPin, loadPinsData, savePinsData } from "../../lib/pins-store.js";
import { normalizePinTitle } from "../../lib/pin-title.js";
import { errorResponse, json } from "../../lib/response.js";

function applyPinUpdates(existing, pin) {
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
    const mediaItems = pin.mediaItems
      .map((item) => ({
        kind: item?.kind === "image" ? "image" : "video",
        url: String(item?.url || "").trim(),
      }))
      .filter((item) => item.url);
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

export async function onRequestPut(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  if (!canEnterEditorMode(auth.role)) {
    return errorResponse("Editor access required", 403);
  }

  const pinId = context.params.pinId;
  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const mapId = body.mapId;
  if (!mapId) {
    return errorResponse("mapId is required", 400);
  }

  const data = await loadPinsData(context.env);
  const found = findPin(data, mapId, pinId);
  if (!found) {
    return errorResponse("Pin not found", 404);
  }

  if (!canModifyPin(found.pin, auth.session.steamId, auth.role)) {
    return errorResponse("Not allowed to edit this trick", 403);
  }

  const built = applyPinUpdates(found.pin, body.pin || {});
  if (built.error) {
    return errorResponse(built.error, 400);
  }

  const mirrored = await mirrorPinMedia(context.env, built.pin);
  if (mirrored.error) {
    return errorResponse(mirrored.error, mirrored.status || 400);
  }

  const mediaError = validatePinMediaFields(mirrored.pin);
  if (mediaError) {
    return errorResponse(mediaError.error, 400);
  }

  found.pins[found.index] = mirrored.pin;

  try {
    await savePinsData(context.env, data);
  } catch (error) {
    console.error(error);
    return errorResponse("Pin storage is not configured", 503);
  }

  return json({ pin: mirrored.pin, mapId });
}

export async function onRequestDelete(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  if (!canEnterEditorMode(auth.role)) {
    return errorResponse("Editor access required", 403);
  }

  const pinId = context.params.pinId;
  const mapId = new URL(context.request.url).searchParams.get("mapId");
  if (!mapId) {
    return errorResponse("mapId query parameter is required", 400);
  }

  const data = await loadPinsData(context.env);
  const found = findPin(data, mapId, pinId);
  if (!found) {
    return errorResponse("Pin not found", 404);
  }

  if (!canModifyPin(found.pin, auth.session.steamId, auth.role)) {
    return errorResponse("Not allowed to delete this trick", 403);
  }

  found.pins.splice(found.index, 1);

  try {
    await savePinsData(context.env, data);
  } catch (error) {
    console.error(error);
    return errorResponse("Pin storage is not configured", 503);
  }

  return json({ ok: true, mapId, pinId });
}
