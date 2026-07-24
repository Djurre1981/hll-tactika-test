import { requireAdmin, readJsonBody } from "../lib/auth-request.js";
import { createLineupForEvent } from "../lib/lineups-store.js";
import { errorResponse, json } from "../lib/response.js";

/** POST /api/lineups — create (or return) lineup for an event and attach it */
export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const parsed = await readJsonBody(context.request);
  if (parsed.error) return parsed.error;

  const eventId = String(parsed.body?.eventId || "").trim();
  if (!eventId) return errorResponse("eventId is required", 400);

  try {
    const result = await createLineupForEvent(context.env, eventId, {
      createdBy: auth.session.steamId,
      rosterSize: parsed.body?.rosterSize,
    });
    if (result.error) {
      return errorResponse(result.error, result.status || 400);
    }
    return json(
      { lineup: result.lineup, created: result.created },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    console.error("POST /api/lineups failed:", error);
    return errorResponse("Failed to create lineup", 500);
  }
}
