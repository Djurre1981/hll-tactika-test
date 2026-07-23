import { requireDb } from "./d1.js";
import { getStrat } from "./strats-store.js";
import { getRoutePlan } from "./route-plans-store.js";
import { getWhiteboard } from "./whiteboards-store.js";
import { getRoster } from "./rosters-store.js";

const COMPONENT_TYPES = {
  strat: "stratIds",
  routePlan: "routePlanIds",
  whiteboard: "whiteboardIds",
  roster: "rosterId",
};

export function emptyEventComponents() {
  return {
    stratIds: [],
    routePlanIds: [],
    whiteboardIds: [],
    rosterId: null,
  };
}

function uniqueIds(values) {
  const seen = new Set();
  const out = [];
  for (const raw of values) {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Normalize components_json from DB or API into a safe shape. */
export function sanitizeEventComponents(input) {
  const base = emptyEventComponents();
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return base;
  }

  return {
    stratIds: uniqueIds(Array.isArray(input.stratIds) ? input.stratIds : []),
    routePlanIds: uniqueIds(Array.isArray(input.routePlanIds) ? input.routePlanIds : []),
    whiteboardIds: uniqueIds(Array.isArray(input.whiteboardIds) ? input.whiteboardIds : []),
    rosterId:
      input.rosterId == null || input.rosterId === ""
        ? null
        : String(input.rosterId).trim() || null,
  };
}

function parseComponentsJson(raw) {
  if (!raw) return emptyEventComponents();
  try {
    return sanitizeEventComponents(JSON.parse(raw));
  } catch {
    return emptyEventComponents();
  }
}

function rowToEvent(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    startsAt: row.starts_at,
    endsAt: row.ends_at || "",
    eventType: row.event_type,
    components: parseComponentsJson(row.components_json),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const EVENT_SELECT = `id, title, description, starts_at, ends_at, event_type, components_json, created_by, created_at, updated_at`;

export async function listEvents(env, { from, to }) {
  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT ${EVENT_SELECT}
       FROM events
       WHERE starts_at >= ? AND starts_at < ?
       ORDER BY starts_at ASC`
    )
    .bind(from, to)
    .all();

  return (result.results || []).map(rowToEvent);
}

export async function getEvent(env, eventId) {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT ${EVENT_SELECT}
       FROM events
       WHERE id = ?`
    )
    .bind(eventId)
    .first();

  return row ? rowToEvent(row) : null;
}

export async function createEvent(env, event) {
  const db = requireDb(env);
  const components = sanitizeEventComponents(event.components);
  await db
    .prepare(
      `INSERT INTO events
       (id, title, description, starts_at, ends_at, event_type, components_json, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      event.id,
      event.title,
      event.description || null,
      event.startsAt,
      event.endsAt || null,
      event.eventType,
      JSON.stringify(components),
      event.createdBy,
      event.createdAt,
      event.updatedAt
    )
    .run();

  return getEvent(env, event.id);
}

export async function updateEvent(env, eventId, updates) {
  const existing = await getEvent(env, eventId);
  if (!existing) return null;

  const next = {
    ...existing,
    ...updates,
    components:
      updates.components !== undefined
        ? sanitizeEventComponents(updates.components)
        : existing.components,
    updatedAt: new Date().toISOString(),
  };

  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE events
       SET title = ?, description = ?, starts_at = ?, ends_at = ?, event_type = ?, components_json = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      next.title,
      next.description || null,
      next.startsAt,
      next.endsAt || null,
      next.eventType,
      JSON.stringify(sanitizeEventComponents(next.components)),
      next.updatedAt,
      eventId
    )
    .run();

  return getEvent(env, eventId);
}

export async function deleteEvent(env, eventId) {
  const existing = await getEvent(env, eventId);
  if (!existing) return null;

  const db = requireDb(env);
  await db.prepare("DELETE FROM events WHERE id = ?").bind(eventId).run();
  return existing;
}

async function assertComponentExists(env, type, id) {
  if (type === "strat") {
    const strat = await getStrat(env, id);
    if (!strat) return { error: "Strat not found", status: 404 };
    return { ok: true };
  }
  if (type === "routePlan") {
    const plan = await getRoutePlan(env, id);
    if (!plan) return { error: "Route plan not found", status: 404 };
    return { ok: true };
  }
  if (type === "whiteboard") {
    const board = await getWhiteboard(env, id);
    if (!board) return { error: "Whiteboard not found", status: 404 };
    return { ok: true };
  }
  if (type === "roster") {
    const roster = await getRoster(env, id);
    if (!roster) return { error: "Roster not found", status: 404 };
    return { ok: true };
  }
  return { error: "Invalid component type", status: 400 };
}

/**
 * Attach or detach a component id on an event.
 * @param {{ action: 'attach'|'detach', type: 'strat'|'routePlan'|'whiteboard'|'roster', id: string }} payload
 */
export async function mutateEventComponent(env, eventId, payload) {
  const event = await getEvent(env, eventId);
  if (!event) return { error: "Event not found", status: 404 };

  const action = String(payload?.action || "").trim();
  const type = String(payload?.type || "").trim();
  const id = String(payload?.id || "").trim();

  if (action !== "attach" && action !== "detach") {
    return { error: "action must be attach or detach", status: 400 };
  }
  if (!COMPONENT_TYPES[type]) {
    return { error: "type must be strat, routePlan, whiteboard, or roster", status: 400 };
  }
  if (!id) {
    return { error: "id is required", status: 400 };
  }

  if (action === "attach") {
    const exists = await assertComponentExists(env, type, id);
    if (exists.error) return exists;
  }

  const components = sanitizeEventComponents(event.components);

  if (type === "roster") {
    if (action === "attach") {
      components.rosterId = id;
    } else if (components.rosterId === id) {
      components.rosterId = null;
    }
  } else {
    const key = COMPONENT_TYPES[type];
    const list = components[key];
    if (action === "attach") {
      if (!list.includes(id)) list.push(id);
    } else {
      components[key] = list.filter((item) => item !== id);
    }
  }

  const updated = await updateEvent(env, eventId, { components });
  return { event: updated };
}
