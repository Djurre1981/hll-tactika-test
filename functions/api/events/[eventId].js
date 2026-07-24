import { requireAuth, requireEditor, readJsonBody } from "../../lib/auth-request.js";
import {
  closeEventRsvp,
  deleteEvent,
  getEvent,
  lockEvent,
  unlockEvent,
  updateEvent,
} from "../../lib/events-store.js";
import { canUnlockEvents } from "../../lib/event-lock.js";
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

  const body = parsed.body || {};

  if (body.lock === true) {
    try {
      const result = await lockEvent(context.env, eventId, auth.session.steamId);
      if (result.error) return errorResponse(result.error, result.status || 400);
      return json({ event: result.event });
    } catch (error) {
      console.error("PATCH /api/events/:eventId lock failed:", error);
      return errorResponse("Failed to lock event", 500);
    }
  }

  if (body.closeRsvp === true) {
    try {
      const result = await closeEventRsvp(context.env, eventId);
      if (result.error) return errorResponse(result.error, result.status || 400);
      return json({ event: result.event });
    } catch (error) {
      console.error("PATCH /api/events/:eventId closeRsvp failed:", error);
      return errorResponse("Failed to close RSVP", 500);
    }
  }

  if (body.unlock === true) {
    if (!canUnlockEvents(auth.role)) {
      return errorResponse("Only administrators and owners can unlock events", 403);
    }
    try {
      const result = await unlockEvent(context.env, eventId);
      if (result.error) return errorResponse(result.error, result.status || 400);
      return json({ event: result.event });
    } catch (error) {
      console.error("PATCH /api/events/:eventId unlock failed:", error);
      return errorResponse("Failed to unlock event", 500);
    }
  }

  const sanitized = sanitizeEventBody(body, { partial: true });
  if (sanitized.error) {
    return errorResponse(sanitized.error, 400);
  }

  try {
    const event = await updateEvent(context.env, eventId, sanitized.event);
    if (!event) {
      return errorResponse("Event not found", 404);
    }
    if (event.error) {
      return errorResponse(event.error, event.status || 400);
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
    if (event.error) {
      return errorResponse(event.error, event.status || 400);
    }
    return json({ ok: true, eventId });
  } catch (error) {
    console.error("DELETE /api/events/:eventId failed:", error);
    return errorResponse("Failed to delete event", 500);
  }
}
