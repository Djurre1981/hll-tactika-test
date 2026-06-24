import { requireAuth } from "../../lib/auth-request.js";
import { canModifyPin } from "../../lib/pin-permissions.js";
import { findPin, loadPinsData, savePinsData } from "../../lib/pins-store.js";
import { errorResponse, json } from "../../lib/response.js";

function applyPinUpdates(existing, pin) {
  const updated = { ...existing };

  if (pin.title !== undefined) {
    updated.title = String(pin.title).trim();
  }
  if (pin.description !== undefined) {
    updated.description = String(pin.description).trim();
  }
  if (pin.tag !== undefined) {
    updated.tag = pin.tag;
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

  found.pins[found.index] = built.pin;

  try {
    await savePinsData(context.env, data);
  } catch (error) {
    console.error(error);
    return errorResponse("Pin storage is not configured", 503);
  }

  return json({ pin: built.pin, mapId });
}

export async function onRequestDelete(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
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
