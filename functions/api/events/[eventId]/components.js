import { requireEditor, readJsonBody } from "../../../lib/auth-request.js";
import { mutateEventComponent } from "../../../lib/events-store.js";
import { errorResponse, json } from "../../../lib/response.js";

function eventIdFromContext(context) {
  return String(context.params?.eventId || "").trim();
}

/** POST /api/events/:eventId/components — attach or detach a linked tool id */
export async function onRequestPost(context) {
  const auth = await requireEditor(context);
  if (auth.error) {
    return auth.error;
  }

  const eventId = eventIdFromContext(context);
  if (!eventId) {
    return errorResponse("Missing event id", 400);
  }

  const parsed = await readJsonBody(context.request);
  if (parsed.error) {
    return parsed.error;
  }

  try {
    const result = await mutateEventComponent(context.env, eventId, parsed.body || {});
    if (result.error) {
      return errorResponse(result.error, result.status || 400);
    }
    return json({ event: result.event });
  } catch (error) {
    console.error("POST /api/events/:eventId/components failed:", error);
    return errorResponse("Failed to update event components", 500);
  }
}
