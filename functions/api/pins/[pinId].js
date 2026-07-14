import { requireAuth } from "../../lib/auth-request.js";
import { mirrorPinMedia } from "../../lib/discord-ingest.js";
import { validatePinMediaFields } from "../../lib/media-urls.js";
import { isValidMapId } from "../../lib/pin-fields.js";
import { canEnterEditorMode, canModifyPin } from "../../lib/pin-permissions.js";
import { guardAccess } from "../../lib/access-guard.js";
import { applyPinUpdates } from "../../lib/pin-mutate.js";
import { findPin, loadPinsData, savePinsData } from "../../lib/pins-store.js";
import { errorResponse, json } from "../../lib/response.js";

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
  if (!isValidMapId(mapId)) {
    return errorResponse("Invalid mapId", 400);
  }

  const access = await guardAccess(context, {
    endpoint: "pins.update",
    steamId: auth.session.steamId,
    steamName: auth.session.name,
    mapId,
    pinId,
  });
  if (access.error) {
    return access.error;
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
  if (!isValidMapId(mapId)) {
    return errorResponse("Invalid mapId", 400);
  }

  const access = await guardAccess(context, {
    endpoint: "pins.delete",
    steamId: auth.session.steamId,
    steamName: auth.session.name,
    mapId,
    pinId,
  });
  if (access.error) {
    return access.error;
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
