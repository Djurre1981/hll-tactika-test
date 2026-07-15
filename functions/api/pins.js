import { guardAccess } from "../lib/access-guard.js";
import { requireAuth } from "../lib/auth-request.js";
import { mirrorPinMedia } from "../lib/discord-ingest.js";
import { validatePinMediaFields } from "../lib/media-urls.js";
import { createDetailToken, assertPinDetailSecretConfigured } from "../lib/pin-detail-token.js";
import {
  normalizePinFaction,
  normalizePinTag,
  sanitizeRequires,
  isValidMapId,
  toPinMarker,
} from "../lib/pin-fields.js";
import { canEnterEditorMode, canModifyPin } from "../lib/pin-permissions.js";
import { resolveCreatorName } from "../lib/pin-creators.js";
import { applyPinUpdates } from "../lib/pin-mutate.js";
import { findPin, loadPinsData, savePinsData } from "../lib/pins-store.js";
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
    let thumbnailMarked = false;
    next.mediaItems = pin.mediaItems
      .map((item) => {
        const url = String(item?.url || "").trim();
        if (!url) return null;
        const nextItem = {
          kind: item?.kind === "image" ? "image" : "video",
          url,
        };
        if (!thumbnailMarked && item?.isThumbnail === true) {
          nextItem.isThumbnail = true;
          thumbnailMarked = true;
        }
        return nextItem;
      })
      .filter(Boolean);
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

  const mapId = new URL(context.request.url).searchParams.get("mapId");
  if (!mapId) {
    return errorResponse("Bulk pin export is not allowed. Request markers with ?mapId=.", 403);
  }
  if (!isValidMapId(mapId)) {
    return errorResponse("Invalid mapId", 400);
  }

  try {
    assertPinDetailSecretConfigured(context.env);

    const access = await guardAccess(context, {
      bucket: "map",
      endpoint: "pins.map",
      steamId: auth.session.steamId,
      steamName: auth.session.name,
      mapId,
    });
    if (access.error) {
      return access.error;
    }

    const data = await loadPinsData(context.env);
    const mapPins = data.pins?.[mapId] || [];
    const mapsWithPins = Object.keys(data.pins || {}).filter(
      (id) => Array.isArray(data.pins[id]) && data.pins[id].length > 0
    );
    const pins = await Promise.all(
      mapPins.map(async (pin) => {
        const detailToken = await createDetailToken(context.env, {
          pinId: pin.id,
          mapId,
          steamId: auth.session.steamId,
        });
        return toPinMarker(pin, detailToken);
      })
    );

    return json({
      mapId,
      pins,
      defaultMapId: data.defaultMapId || null,
      mapsWithPins,
    });
  } catch (error) {
    console.error("GET /api/pins failed:", error);
    if (String(error?.message || "").includes("PIN_DETAIL_SECRET")) {
      return errorResponse(error.message, 503);
    }
    return errorResponse("Failed to load map markers", 500);
  }
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

  if (!isValidMapId(mapId)) {
    return errorResponse("Invalid mapId", 400);
  }

  const access = await guardAccess(context, {
    endpoint: "pins.create",
    steamId: auth.session.steamId,
    steamName: auth.session.name,
    mapId,
    statusOnSuccess: 201,
  });
  if (access.error) {
    return access.error;
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
    id: `pin-${crypto.randomUUID()}`,
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

/** Batch-update pins on one map in a single KV write. Body: `{ mapId, pins: [{ id, ...fields }] }`. */
export async function onRequestPatch(context) {
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

  const mapId = body.mapId;
  const pinUpdates = Array.isArray(body.pins) ? body.pins : null;
  if (!mapId || !pinUpdates) {
    return errorResponse("mapId and pins[] are required", 400);
  }
  if (!isValidMapId(mapId)) {
    return errorResponse("Invalid mapId", 400);
  }
  if (pinUpdates.length === 0) {
    return json({ mapId, pins: [] });
  }
  if (pinUpdates.length > 200) {
    return errorResponse("Too many pins in one batch (max 200)", 400);
  }

  const access = await guardAccess(context, {
    endpoint: "pins.batch",
    steamId: auth.session.steamId,
    steamName: auth.session.name,
    mapId,
  });
  if (access.error) {
    return access.error;
  }

  const data = await loadPinsData(context.env);
  const updatedPins = [];

  for (const entry of pinUpdates) {
    const pinId = String(entry?.id || "").trim();
    if (!pinId) {
      return errorResponse("Each pin update requires id", 400);
    }

    const found = findPin(data, mapId, pinId);
    if (!found) {
      return errorResponse(`Pin not found: ${pinId}`, 404);
    }

    if (!canModifyPin(found.pin, auth.session.steamId, auth.role)) {
      return errorResponse(`Not allowed to edit trick ${pinId}`, 403);
    }

    const { id: _ignoreId, ...fields } = entry;
    const built = applyPinUpdates(found.pin, fields);
    if (built.error) {
      return errorResponse(`${pinId}: ${built.error}`, 400);
    }

    const mediaError = validatePinMediaFields(built.pin);
    if (mediaError) {
      return errorResponse(`${pinId}: ${mediaError.error}`, 400);
    }

    found.pins[found.index] = built.pin;
    updatedPins.push(built.pin);
  }

  try {
    await savePinsData(context.env, data);
  } catch (error) {
    console.error(error);
    return errorResponse("Pin storage is not configured", 503);
  }

  return json({ mapId, pins: updatedPins });
}
