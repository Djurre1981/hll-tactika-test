import { requireOwner } from "../../lib/auth-request.js";
import { requireDb } from "../../lib/d1.js";
import { enrichPinsData } from "../../lib/pin-creators.js";
import { loadPinsData } from "../../lib/pins-store.js";
import { errorResponse, json } from "../../lib/response.js";

export async function onRequestGet(context) {
  const auth = await requireOwner(context);
  if (auth.error) {
    return auth.error;
  }

  try {
    requireDb(context.env);
  } catch {
    return errorResponse("Pin database is not configured", 503);
  }

  const data = await loadPinsData(context.env);
  const enriched = await enrichPinsData(data, context.env);
  const pinCount = Object.values(enriched.pins || {}).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0
  );

  return json({
    defaultMapId: enriched.defaultMapId,
    pins: enriched.pins,
    pinCount,
    source: "d1",
    exportedAt: new Date().toISOString(),
    exportedBy: auth.session.steamId,
  });
}
