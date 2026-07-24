import { requireDb } from "./d1.js";
import {
  enrichEventLockState,
  isEventEffectivelyLocked,
} from "./event-lock.js";
import { normalizeStratMatch } from "./strat-fields.js";
import { getStrat } from "./strats-store.js";
import { getRoutePlan } from "./route-plans-store.js";
import { getWhiteboard } from "./whiteboards-store.js";
import { getRoster } from "./rosters-store.js";
import { sanitizeRosterSize } from "./lineup-layouts.js";

const COMPONENT_TYPES = {
  strat: "stratIds",
  routePlan: "routePlanIds",
  whiteboard: "whiteboardIds",
  roster: "rosterId",
  lineup: "lineupId",
};

const SINGLE_ID_TYPES = new Set(["roster", "lineup"]);

export function emptyEventComponents() {
  return {
    stratIds: [],
    routePlanIds: [],
    whiteboardIds: [],
    rosterId: null,
    lineupId: null,
  };
}

export function emptyEventMatch() {
  return normalizeStratMatch({});
}

/** Normalize match_json from DB or API into a safe shape. */
export function sanitizeEventMatch(input) {
  return normalizeStratMatch(input);
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
    lineupId:
      input.lineupId == null || input.lineupId === ""
        ? null
        : String(input.lineupId).trim() || null,
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

function parseMatchJson(raw) {
  if (!raw) return emptyEventMatch();
  try {
    return sanitizeEventMatch(JSON.parse(raw));
  } catch {
    return emptyEventMatch();
  }
}

function rowToEvent(row) {
  const event = {
    id: row.id,
    title: row.title,
    description: row.description || "",
    startsAt: row.starts_at,
    endsAt: row.ends_at || "",
    eventType: row.event_type,
    signupTarget: row.signup_target == null ? null : Number(row.signup_target),
    rosterSize: row.roster_size == null ? null : Number(row.roster_size),
    match: parseMatchJson(row.match_json),
    components: parseComponentsJson(row.components_json),
    locked: Boolean(row.locked),
    lockOverride: Boolean(row.lock_override),
    lockedBy: row.locked_by || null,
    lockedAt: row.locked_at || null,
    rsvpClosed: Boolean(row.rsvp_closed),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (event.signupTarget != null && !Number.isInteger(event.signupTarget)) {
    event.signupTarget = null;
  }
  if (![18, 36, 49].includes(event.rosterSize)) event.rosterSize = null;
  return enrichEventLockState(event);
}

const EVENT_SELECT = `id, title, description, starts_at, ends_at, event_type, signup_target, roster_size, match_json, components_json,
  locked, lock_override, locked_by, locked_at, rsvp_closed, created_by, created_at, updated_at`;

function normalizeRosterSize(value) {
  if (value == null || value === "") return null;
  const check = sanitizeRosterSize(value);
  if (check.error) return { error: check.error };
  return check.rosterSize;
}

export function assertEventEditable(event) {
  if (isEventEffectivelyLocked(event)) {
    return { error: "Event is locked", status: 423 };
  }
  return { ok: true };
}

export async function lockEvent(env, eventId, steamId) {
  const existing = await getEvent(env, eventId);
  if (!existing) return { error: "Event not found", status: 404 };

  const now = new Date().toISOString();
  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE events
       SET locked = 1, lock_override = 0, locked_by = ?, locked_at = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(steamId, now, now, eventId)
    .run();

  return { event: await getEvent(env, eventId) };
}

export async function closeEventRsvp(env, eventId) {
  const existing = await getEvent(env, eventId);
  if (!existing) return { error: "Event not found", status: 404 };
  if (existing.rsvpClosed) return { event: existing };

  const now = new Date().toISOString();
  const db = requireDb(env);
  await db
    .prepare(`UPDATE events SET rsvp_closed = 1, updated_at = ? WHERE id = ?`)
    .bind(now, eventId)
    .run();

  return { event: await getEvent(env, eventId) };
}

export async function unlockEvent(env, eventId) {
  const existing = await getEvent(env, eventId);
  if (!existing) return { error: "Event not found", status: 404 };

  const now = new Date().toISOString();
  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE events
       SET locked = 0, lock_override = 1, locked_by = NULL, locked_at = NULL, updated_at = ?
       WHERE id = ?`
    )
    .bind(now, eventId)
    .run();

  return { event: await getEvent(env, eventId) };
}

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
  const match = sanitizeEventMatch(event.match);
  const signupTarget =
    event.signupTarget == null || event.signupTarget === ""
      ? null
      : Number(event.signupTarget);
  const rosterSize = normalizeRosterSize(event.rosterSize);
  if (rosterSize?.error) {
    throw new Error(rosterSize.error);
  }

  await db
    .prepare(
      `INSERT INTO events
       (id, title, description, starts_at, ends_at, event_type, signup_target, roster_size, match_json, components_json,
        locked, lock_override, locked_by, locked_at, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      event.id,
      event.title,
      event.description || null,
      event.startsAt,
      event.endsAt || null,
      event.eventType,
      Number.isInteger(signupTarget) ? signupTarget : null,
      rosterSize,
      JSON.stringify(match),
      JSON.stringify(components),
      0,
      0,
      null,
      null,
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

  const editable = assertEventEditable(existing);
  if (editable.error) {
    return { error: editable.error, status: editable.status };
  }

  let signupTarget = existing.signupTarget;
  if (updates.signupTarget !== undefined) {
    if (updates.signupTarget == null || updates.signupTarget === "") {
      signupTarget = null;
    } else {
      const n = Number(updates.signupTarget);
      signupTarget = Number.isInteger(n) ? n : existing.signupTarget;
    }
  }

  let rosterSize = existing.rosterSize;
  if (updates.rosterSize !== undefined) {
    const normalized = normalizeRosterSize(updates.rosterSize);
    if (normalized?.error) {
      return { error: normalized.error, status: 400 };
    }
    rosterSize = normalized;
  }

  const next = {
    ...existing,
    ...updates,
    components:
      updates.components !== undefined
        ? sanitizeEventComponents(updates.components)
        : existing.components,
    match:
      updates.match !== undefined ? sanitizeEventMatch(updates.match) : existing.match,
    signupTarget,
    rosterSize,
    updatedAt: new Date().toISOString(),
  };

  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE events
       SET title = ?, description = ?, starts_at = ?, ends_at = ?, event_type = ?, signup_target = ?, roster_size = ?,
           match_json = ?, components_json = ?,
           locked = ?, lock_override = ?, locked_by = ?, locked_at = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      next.title,
      next.description || null,
      next.startsAt,
      next.endsAt || null,
      next.eventType,
      next.signupTarget,
      next.rosterSize,
      JSON.stringify(sanitizeEventMatch(next.match)),
      JSON.stringify(sanitizeEventComponents(next.components)),
      next.locked ? 1 : 0,
      next.lockOverride ? 1 : 0,
      next.lockedBy || null,
      next.lockedAt || null,
      next.updatedAt,
      eventId
    )
    .run();

  return getEvent(env, eventId);
}

export async function deleteEvent(env, eventId) {
  const existing = await getEvent(env, eventId);
  if (!existing) return null;

  const editable = assertEventEditable(existing);
  if (editable.error) {
    return { error: editable.error, status: editable.status };
  }

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
  if (type === "lineup") {
    const db = requireDb(env);
    const row = await db
      .prepare("SELECT id FROM lineups WHERE id = ?")
      .bind(id)
      .first();
    if (!row) return { error: "Lineup not found", status: 404 };
    return { ok: true };
  }
  return { error: "Invalid component type", status: 400 };
}

/**
 * Attach or detach a component id on an event.
 * @param {{ action: 'attach'|'detach', type: 'strat'|'routePlan'|'whiteboard'|'roster'|'lineup', id: string }} payload
 */
export async function mutateEventComponent(env, eventId, payload) {
  const event = await getEvent(env, eventId);
  if (!event) return { error: "Event not found", status: 404 };

  const editable = assertEventEditable(event);
  if (editable.error) return editable;

  const action = String(payload?.action || "").trim();
  const type = String(payload?.type || "").trim();
  const id = String(payload?.id || "").trim();

  if (action !== "attach" && action !== "detach") {
    return { error: "action must be attach or detach", status: 400 };
  }
  if (!COMPONENT_TYPES[type]) {
    return {
      error: "type must be strat, routePlan, whiteboard, roster, or lineup",
      status: 400,
    };
  }
  if (!id) {
    return { error: "id is required", status: 400 };
  }

  if (action === "attach") {
    const exists = await assertComponentExists(env, type, id);
    if (exists.error) return exists;
  }

  const components = sanitizeEventComponents(event.components);

  if (SINGLE_ID_TYPES.has(type)) {
    const key = COMPONENT_TYPES[type];
    if (action === "attach") {
      components[key] = id;
    } else if (components[key] === id) {
      components[key] = null;
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
  if (updated?.error) return updated;
  return { event: updated };
}
