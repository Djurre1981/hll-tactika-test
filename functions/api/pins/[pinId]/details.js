import { guardAccess } from "../../../lib/access-guard.js";
import { requireAuth } from "../../../lib/auth-request.js";
import { enrichPin } from "../../../lib/pin-creators.js";
import { toPinDetail } from "../../../lib/pin-fields.js";
import { verifyDetailToken } from "../../../lib/pin-detail-token.js";
import { findPin, loadPinsData } from "../../../lib/pins-store.js";
import { errorResponse, json, tokenExpiredResponse } from "../../../lib/response.js";

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  const pinId = String(context.params.pinId || "").trim();
  const url = new URL(context.request.url);
  const mapId = url.searchParams.get("mapId");
  const token = url.searchParams.get("token");

  if (!mapId) {
    return errorResponse("mapId query parameter is required", 400);
  }
  if (!token) {
    return errorResponse("token query parameter is required", 400);
  }

  const access = await guardAccess(context, {
    bucket: "detail",
    endpoint: "pins.detail",
    steamId: auth.session.steamId,
    mapId,
    pinId,
  });
  if (access.error) {
    return access.error;
  }

  const verification = await verifyDetailToken(context.env, token, {
    pinId,
    mapId,
    steamId: auth.session.steamId,
  });

  if (verification.status === "expired") {
    return tokenExpiredResponse();
  }
  if (verification.status !== "ok") {
    return errorResponse("Invalid detail token", 403);
  }

  const data = await loadPinsData(context.env);
  const found = findPin(data, mapId, pinId);
  if (!found) {
    return errorResponse("Pin not found", 404);
  }

  const enriched = await enrichPin(found.pin, context.env, auth.session);
  return json({ pin: toPinDetail(enriched), mapId });
}
