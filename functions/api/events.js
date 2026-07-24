import { requireAuth, requireEditor, readJsonBody } from "../lib/auth-request.js";
import {
  listEvents,
  createEvent,
  emptyEventComponents,
  emptyEventMatch,
  sanitizeEventComponents,
  sanitizeEventMatch,
} from "../lib/events-store.js";
import { sanitizeRosterSize } from "../lib/lineup-layouts.js";
import { defaultSignupTarget, sanitizeSignupTarget } from "../lib/rsvp-reasons.js";
import { errorResponse, json } from "../lib/response.js";

const EVENT_TYPES = ["scrim", "comp", "practice", "other"];

function isIsoDate(value) {
  if (!value || typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}

function monthRange(searchParams) {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from || to) {
    if (!isIsoDate(from) || !isIsoDate(to) || Date.parse(from) >= Date.parse(to)) {
      return { error: "Invalid from/to range" };
    }
    return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
  }

  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { error: "Provide year and month query parameters" };
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { from: start.toISOString(), to: end.toISOString() };
}

function sanitizeEventBody(body, { partial = false } = {}) {
  const event = {};

  if (!partial || Object.hasOwn(body, "title")) {
    const title = String(body.title || "").trim();
    if (!title) return { error: "Event title is required" };
    if (title.length > 120) return { error: "Event title is too long" };
    event.title = title;
  }

  if (Object.hasOwn(body, "description")) {
    event.description = String(body.description || "").trim().slice(0, 1000);
  } else if (!partial) {
    event.description = "";
  }

  if (!partial || Object.hasOwn(body, "startsAt")) {
    if (!isIsoDate(body.startsAt)) return { error: "Valid startsAt is required" };
    event.startsAt = new Date(body.startsAt).toISOString();
  }

  if (Object.hasOwn(body, "endsAt")) {
    if (body.endsAt && !isIsoDate(body.endsAt)) return { error: "Valid endsAt is required" };
    event.endsAt = body.endsAt ? new Date(body.endsAt).toISOString() : "";
  } else if (!partial) {
    event.endsAt = "";
  }

  if (event.endsAt && event.startsAt && Date.parse(event.endsAt) < Date.parse(event.startsAt)) {
    return { error: "endsAt must be after startsAt" };
  }

  if (Object.hasOwn(body, "eventType")) {
    const eventType = String(body.eventType || "other").trim();
    if (!EVENT_TYPES.includes(eventType)) return { error: "Invalid eventType" };
    event.eventType = eventType;
  } else if (!partial) {
    event.eventType = "other";
  }

  if (Object.hasOwn(body, "components")) {
    event.components = sanitizeEventComponents(body.components);
  } else if (!partial) {
    event.components = emptyEventComponents();
  }

  if (Object.hasOwn(body, "match")) {
    event.match = sanitizeEventMatch(body.match);
  } else if (!partial) {
    event.match = emptyEventMatch();
  }

  if (Object.hasOwn(body, "signupTarget")) {
    const seats = sanitizeSignupTarget(body.signupTarget);
    if (seats.error) return { error: seats.error };
    event.signupTarget = seats.signupTarget;
  } else if (!partial) {
    event.signupTarget = defaultSignupTarget(event.eventType);
  }

  if (Object.hasOwn(body, "rosterSize")) {
    if (body.rosterSize == null || body.rosterSize === "") {
      event.rosterSize = null;
    } else {
      const size = sanitizeRosterSize(body.rosterSize);
      if (size.error) return { error: size.error };
      event.rosterSize = size.rosterSize;
    }
  } else if (!partial) {
    event.rosterSize = null;
  }

  return { event };
}

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  const range = monthRange(new URL(context.request.url).searchParams);
  if (range.error) {
    return errorResponse(range.error, 400);
  }

  try {
    const events = await listEvents(context.env, range);
    return json({ events });
  } catch (error) {
    console.error("GET /api/events failed:", error);
    return errorResponse("Failed to load events", 500);
  }
}

export async function onRequestPost(context) {
  const auth = await requireEditor(context);
  if (auth.error) {
    return auth.error;
  }

  const parsed = await readJsonBody(context.request);
  if (parsed.error) {
    return parsed.error;
  }

  const sanitized = sanitizeEventBody(parsed.body || {});
  if (sanitized.error) {
    return errorResponse(sanitized.error, 400);
  }

  const now = new Date().toISOString();
  try {
    const event = await createEvent(context.env, {
      ...sanitized.event,
      id: `event-${crypto.randomUUID()}`,
      createdBy: auth.session.steamId,
      createdAt: now,
      updatedAt: now,
    });
    return json({ event }, { status: 201 });
  } catch (error) {
    console.error("POST /api/events failed:", error);
    return errorResponse("Failed to create event", 500);
  }
}

export { sanitizeEventBody };
