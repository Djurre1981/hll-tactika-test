import { requireAuth, requireEditor, readJsonBody } from "../../lib/auth-request.js";
import { deleteEvent, getEvent, updateEvent } from "../../lib/events-store.js";
import { errorResponse, json } from "../../lib/response.js";
import { sanitizeEventBody } from "../events.js";

function eventIdFromContext(context) {
  return String(context.params?.eventId || "").trim();
}

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  const eventId = eventIdFromContext(context);
  if (!eventId) {
    return errorResponse("Missing event id", 400);
  }

  try {
    const event = await getEvent(context.env, eventId);
    if (!event) {
      return errorResponse("Event not found", 404);
    }
    return json({ event });
  } catch (error) {
    console.error("GET /api/events/:eventId failed:", error);
    return errorResponse("Failed to load event", 500);
  }
}

export async function onRequestPatch(context) {
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

  const sanitized = sanitizeEventBody(parsed.body || {}, { partial: true });
  if (sanitized.error) {
    return errorResponse(sanitized.error, 400);
  }

  try {
    const event = await updateEvent(context.env, eventId, sanitized.event);
    if (!event) {
      return errorResponse("Event not found", 404);
    }
    return json({ event });
  } catch (error) {
    console.error("PATCH /api/events/:eventId failed:", error);
    return errorResponse("Failed to update event", 500);
  }
}

export async function onRequestDelete(context) {
  const auth = await requireEditor(context);
  if (auth.error) {
    return auth.error;
  }

  const eventId = eventIdFromContext(context);
  if (!eventId) {
    return errorResponse("Missing event id", 400);
  }

  try {
    const event = await deleteEvent(context.env, eventId);
    if (!event) {
      return errorResponse("Event not found", 404);
    }
    return json({ ok: true, eventId });
  } catch (error) {
    console.error("DELETE /api/events/:eventId failed:", error);
    return errorResponse("Failed to delete event", 500);
  }
}
