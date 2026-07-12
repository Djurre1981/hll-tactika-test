import { requireAuth } from "../lib/auth-request.js";
import { mirrorPinMedia } from "../lib/discord-ingest.js";
import { validatePinMediaFields } from "../lib/media-urls.js";
import {
  normalizePinFaction,
  normalizePinTag,
  sanitizeRequires,
} from "../lib/pin-fields.js";
import { canEnterEditorMode } from "../lib/pin-permissions.js";
import { enrichPinsData, resolveCreatorName } from "../lib/pin-creators.js";
import { loadPinsData, savePinsData } from "../lib/pins-store.js";
import { normalizePinTitle } from "../lib/pin-title.js";
import { errorResponse, json } from "../lib/response.js";

function buildPinFromBody(pin, createdBy) {
  const next = {
    id: pin.id,
    title: normalizePinTitle(pin.title),
    description: String(pin.description || "").trim(),
    tag: normalizePinTag(pin.tag),
    x: Number(pin.x),
    y: Number(pin.y),
    videoUrl: String(pin.videoUrl || "").trim(),
    createdBy,
  };

  if (!next.title) {
    return { error: "Title is required" };
  }
  if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) {
    return { error: "Valid pin coordinates are required" };
  }

  const thumbnail = String(pin.thumbnail || "").trim();
  if (thumbnail) {
    next.thumbnail = thumbnail;
  }

  next.faction = normalizePinFaction(pin.faction);
  next.requires = sanitizeRequires(pin.requires);

  if (Array.isArray(pin.mediaItems) && pin.mediaItems.length > 0) {
    next.mediaItems = pin.mediaItems
      .map((item) => ({
        kind: item?.kind === "image" ? "image" : "video",
        url: String(item?.url || "").trim(),
      }))
      .filter((item) => item.url);
  }

  if (next.tag === "mg-spot") {
    const dirX = Number(pin.dirX);
    const dirY = Number(pin.dirY);
    if (!Number.isFinite(dirX) || !Number.isFinite(dirY)) {
      return { error: "MG spot direction is required" };
    }
    if (dirX === next.x && dirY === next.y) {
      return { error: "MG spot direction must differ from the base" };
    }
    next.dirX = dirX;
    next.dirY = dirY;
  }

  const sourceDiscordMessageId = String(pin.sourceDiscordMessageId || "").trim();
  if (sourceDiscordMessageId) {
    next.sourceDiscordMessageId = sourceDiscordMessageId;
  }

  return { pin: next };
}

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  const data = await loadPinsData(context.env);
  const enriched = await enrichPinsData(data, context.env);
  return json(enriched);
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  if (!canEnterEditorMode(auth.role)) {
    return errorResponse("Editor access required", 403);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { mapId, pin } = body;
  if (!mapId || !pin) {
    return errorResponse("mapId and pin are required", 400);
  }

  const built = buildPinFromBody(pin, auth.session.steamId);
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

  const createdByName = await resolveCreatorName(
    auth.session.steamId,
    context.env,
    auth.session
  );

  const data = await loadPinsData(context.env);
  if (!data.pins[mapId]) {
    data.pins[mapId] = [];
  }

  const newPin = {
    ...mirrored.pin,
    id: built.pin.id || `pin-${crypto.randomUUID()}`,
    createdBy: auth.session.steamId,
    createdByName,
  };

  data.pins[mapId].push(newPin);

  try {
    await savePinsData(context.env, data);
  } catch (error) {
    console.error(error);
    return errorResponse("Pin storage is not configured", 503);
  }

  return json({ pin: newPin, mapId }, { status: 201 });
}
