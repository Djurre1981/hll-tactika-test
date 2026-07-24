import { requireAuth, readJsonBody } from "../../../lib/auth-request.js";
import { canEnterEditorMode } from "../../../lib/pin-permissions.js";
import { getEvent } from "../../../lib/events-store.js";
import {
  listRsvpsForEvent,
  presentRsvpPayload,
  sanitizeRsvpStatus,
  upsertRsvp,
} from "../../../lib/rsvps-store.js";
import { errorResponse, json } from "../../../lib/response.js";

function eventIdFromContext(context) {
  return String(context.params?.eventId || "").trim();
}

/** GET /api/events/:eventId/rsvps */
export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const eventId = eventIdFromContext(context);
  if (!eventId) return errorResponse("Missing event id", 400);

  try {
    const event = await getEvent(context.env, eventId);
    if (!event) return errorResponse("Event not found", 404);

    const rsvps = await listRsvpsForEvent(context.env, eventId);
    const canSeeAllReasons = canEnterEditorMode(auth.role);
    return json(
      await presentRsvpPayload({
        rsvps,
        event,
        viewerSteamId: auth.session.steamId,
        canSeeAllReasons,
        env: context.env,
      })
    );
  } catch (error) {
    console.error("GET /api/events/:eventId/rsvps failed:", error);
    return errorResponse("Failed to load RSVPs", 500);
  }
}

async function upsertOwnOrEditorRsvp(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const eventId = eventIdFromContext(context);
  if (!eventId) return errorResponse("Missing event id", 400);

  const parsed = await readJsonBody(context.request);
  if (parsed.error) return parsed.error;

  const sanitized = sanitizeRsvpStatus(parsed.body?.status);
  if (sanitized.error) return errorResponse(sanitized.error, 400);

  const isEditor = canEnterEditorMode(auth.role);
  let steamId = auth.session.steamId;
  if (Object.hasOwn(parsed.body || {}, "steamId")) {
    if (!isEditor) {
      return errorResponse("Editor access required to set RSVP for others", 403);
    }
    steamId = String(parsed.body.steamId || "").trim();
    if (!steamId) return errorResponse("steamId cannot be empty", 400);
  }

  try {
    const result = await upsertRsvp(context.env, eventId, steamId, {
      status: sanitized.status,
      reasonCode: parsed.body?.reasonCode,
      reasonNote: parsed.body?.reasonNote,
      forceConfirm: Boolean(parsed.body?.forceConfirm),
      isEditor,
    });
    if (result.error) return errorResponse(result.error, result.status || 400);

    const event = await getEvent(context.env, eventId);
    return json({
      rsvp: result.rsvp,
      ...(await presentRsvpPayload({
        rsvps: result.rsvps,
        event,
        viewerSteamId: auth.session.steamId,
        canSeeAllReasons: isEditor,
        promoted: result.promoted,
        env: context.env,
      })),
    });
  } catch (error) {
    console.error("RSVP upsert failed:", error);
    return errorResponse("Failed to save RSVP", 500);
  }
}

/** PUT /api/events/:eventId/rsvps — set RSVP (body: { status, reasonCode?, reasonNote?, steamId? }) */
export async function onRequestPut(context) {
  return upsertOwnOrEditorRsvp(context);
}

/** POST /api/events/:eventId/rsvps — same as PUT */
export async function onRequestPost(context) {
  return upsertOwnOrEditorRsvp(context);
}
