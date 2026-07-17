import { guardAccess } from "../../lib/access-guard.js";
import { requireAuth } from "../../lib/auth-request.js";
import { deleteEvent, updateEvent } from "../../lib/events-store.js";
import { canEnterEditorMode } from "../../lib/pin-permissions.js";
import { errorResponse, json } from "../../lib/response.js";
import { sanitizeEventBody } from "../events.js";

function eventIdFromContext(context) {
  return String(context.params?.eventId || "").trim();
}

async function requireEditor(context, endpoint) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth;
  }

  if (!canEnterEditorMode(auth.role)) {
    return { error: errorResponse("Editor access required", 403) };
  }

  const access = await guardAccess(context, {
    bucket: "events",
    endpoint,
    steamId: auth.session.steamId,
    steamName: auth.session.name,
  });
  if (access.error) {
    return { error: access.error };
  }

  return auth;
}

export async function onRequestPatch(context) {
  const auth = await requireEditor(context, "events.update");
  if (auth.error) {
    return auth.error;
  }

  const eventId = eventIdFromContext(context);
  if (!eventId) {
    return errorResponse("Missing event id", 400);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const sanitized = sanitizeEventBody(body || {}, { partial: true });
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
  const auth = await requireEditor(context, "events.delete");
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
