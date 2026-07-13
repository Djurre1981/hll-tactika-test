import { guardAccess } from "../../lib/access-guard.js";
import { requireOwner } from "../../lib/auth-request.js";
import { enrichPinsData } from "../../lib/pin-creators.js";
import { loadPinsData } from "../../lib/pins-store.js";
import { json } from "../../lib/response.js";

export async function onRequestGet(context) {
  const auth = await requireOwner(context);
  if (auth.error) {
    return auth.error;
  }

  const access = await guardAccess(context, {
    bucket: "admin_export",
    endpoint: "admin.export",
    steamId: auth.session.steamId,
    steamName: auth.session.name,
  });
  if (access.error) {
    return access.error;
  }

  const data = await loadPinsData(context.env);
  const enriched = await enrichPinsData(data, context.env);

  return json({
    defaultMapId: enriched.defaultMapId,
    pins: enriched.pins,
    exportedAt: new Date().toISOString(),
    exportedBy: auth.session.steamId,
  });
}
