import { guardAccess } from "../../../lib/access-guard.js";
import { requireAuth } from "../../../lib/auth-request.js";
import { createDetailToken } from "../../../lib/pin-detail-token.js";
import { findPin, loadPinsData } from "../../../lib/pins-store.js";
import { errorResponse, json } from "../../../lib/response.js";

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  const pinId = String(context.params.pinId || "").trim();
  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const mapId = String(body?.mapId || "").trim();
  if (!mapId) {
    return errorResponse("mapId is required in request body", 400);
  }

  const access = await guardAccess(context, {
    bucket: "token",
    endpoint: "pins.token",
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

  const detailToken = await createDetailToken(context.env, {
    pinId,
    mapId,
    steamId: auth.session.steamId,
  });

  return json({ detailToken });
}
