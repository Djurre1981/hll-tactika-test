import { requireAuth, readJsonBody } from "../../lib/auth-request.js";
import { canEnterEditorMode } from "../../lib/pin-permissions.js";
import { getEvent } from "../../lib/events-store.js";
import { presentRsvpPayload, upsertRsvp } from "../../lib/rsvps-store.js";
import { errorResponse, json } from "../../lib/response.js";

/**
 * POST /api/rsvps/raincheck
 * Body: { eventId, reasonCode, reasonNote? }
 */
export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const parsed = await readJsonBody(context.request);
  if (parsed.error) return parsed.error;

  const eventId = String(parsed.body?.eventId || "").trim();
  if (!eventId) return errorResponse("eventId is required", 400);

  const isEditor = canEnterEditorMode(auth.role);

  try {
    const result = await upsertRsvp(context.env, eventId, auth.session.steamId, {
      status: "declined",
      reasonCode: parsed.body?.reasonCode,
      reasonNote: parsed.body?.reasonNote,
      isEditor,
    });
    if (result.error) return errorResponse(result.error, result.status || 400);

    const event = await getEvent(context.env, eventId);
    return json({
      rsvp: result.rsvp,
      ...presentRsvpPayload({
        rsvps: result.rsvps,
        event,
        viewerSteamId: auth.session.steamId,
        canSeeAllReasons: isEditor,
        promoted: result.promoted,
      }),
    });
  } catch (error) {
    console.error("POST /api/rsvps/raincheck failed:", error);
    return errorResponse("Failed to save raincheck", 500);
  }
}
