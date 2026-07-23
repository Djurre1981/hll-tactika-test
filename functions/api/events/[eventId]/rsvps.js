import { requireAuth, readJsonBody } from "../../../lib/auth-request.js";
import { canEnterEditorMode } from "../../../lib/pin-permissions.js";
import {
  listRsvpsForEvent,
  sanitizeRsvpStatus,
  summarizeRsvpCounts,
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
    const rsvps = await listRsvpsForEvent(context.env, eventId);
    const mine = rsvps.find((row) => row.steamId === auth.session.steamId) || null;
    return json({
      rsvps,
      counts: summarizeRsvpCounts(rsvps),
      mine,
    });
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

  let steamId = auth.session.steamId;
  if (Object.hasOwn(parsed.body || {}, "steamId")) {
    if (!canEnterEditorMode(auth.role)) {
      return errorResponse("Editor access required to set RSVP for others", 403);
    }
    steamId = String(parsed.body.steamId || "").trim();
    if (!steamId) return errorResponse("steamId cannot be empty", 400);
  }

  try {
    const result = await upsertRsvp(context.env, eventId, steamId, sanitized.status);
    if (result.error) return errorResponse(result.error, result.status || 400);
    const rsvps = await listRsvpsForEvent(context.env, eventId);
    return json({
      rsvp: result.rsvp,
      rsvps,
      counts: summarizeRsvpCounts(rsvps),
      mine: rsvps.find((row) => row.steamId === auth.session.steamId) || null,
    });
  } catch (error) {
    console.error("RSVP upsert failed:", error);
    return errorResponse("Failed to save RSVP", 500);
  }
}

/** PUT /api/events/:eventId/rsvps — set RSVP (body: { status, steamId? }) */
export async function onRequestPut(context) {
  return upsertOwnOrEditorRsvp(context);
}

/** POST /api/events/:eventId/rsvps — same as PUT */
export async function onRequestPost(context) {
  return upsertOwnOrEditorRsvp(context);
}
