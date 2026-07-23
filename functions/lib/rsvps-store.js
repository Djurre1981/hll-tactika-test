import { requireDb } from "./d1.js";
import { getEvent } from "./events-store.js";

export const RSVP_STATUSES = ["confirmed", "tentative", "declined", "unavailable"];

function rowToRsvp(row) {
  return {
    eventId: row.event_id,
    steamId: row.steam_id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export function sanitizeRsvpStatus(raw) {
  const status = String(raw || "").trim().toLowerCase();
  if (!RSVP_STATUSES.includes(status)) {
    return { error: "status must be confirmed, tentative, declined, or unavailable" };
  }
  return { status };
}

export async function listRsvpsForEvent(env, eventId) {
  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT event_id, steam_id, status, updated_at
       FROM rsvps
       WHERE event_id = ?
       ORDER BY
         CASE status
           WHEN 'confirmed' THEN 0
           WHEN 'tentative' THEN 1
           WHEN 'declined' THEN 2
           WHEN 'unavailable' THEN 3
           ELSE 4
         END,
         updated_at DESC`
    )
    .bind(eventId)
    .all();

  return (result.results || []).map(rowToRsvp);
}

export async function getRsvp(env, eventId, steamId) {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT event_id, steam_id, status, updated_at
       FROM rsvps
       WHERE event_id = ? AND steam_id = ?`
    )
    .bind(eventId, steamId)
    .first();
  return row ? rowToRsvp(row) : null;
}

export async function upsertRsvp(env, eventId, steamId, status) {
  const event = await getEvent(env, eventId);
  if (!event) return { error: "Event not found", status: 404 };

  const sanitized = sanitizeRsvpStatus(status);
  if (sanitized.error) return { error: sanitized.error, status: 400 };

  const now = new Date().toISOString();
  const db = requireDb(env);
  await db
    .prepare(
      `INSERT INTO rsvps (event_id, steam_id, status, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(event_id, steam_id) DO UPDATE SET
         status = excluded.status,
         updated_at = excluded.updated_at`
    )
    .bind(eventId, steamId, sanitized.status, now)
    .run();

  const rsvp = await getRsvp(env, eventId, steamId);
  return { rsvp };
}

export async function deleteRsvp(env, eventId, steamId) {
  const db = requireDb(env);
  await db
    .prepare(`DELETE FROM rsvps WHERE event_id = ? AND steam_id = ?`)
    .bind(eventId, steamId)
    .run();
  return { ok: true };
}

export function summarizeRsvpCounts(rsvps = []) {
  const counts = {
    confirmed: 0,
    tentative: 0,
    declined: 0,
    unavailable: 0,
    total: 0,
  };
  for (const row of rsvps) {
    if (RSVP_STATUSES.includes(row.status)) {
      counts[row.status] += 1;
      counts.total += 1;
    }
  }
  return counts;
}

/** Incomplete RSVPs are not tracked; rolling attendance = confirmed / (confirmed+declined+unavailable) over window. */
export async function listRsvpsForEvents(env, eventIds) {
  const ids = (eventIds || []).map((id) => String(id || "").trim()).filter(Boolean);
  if (!ids.length) return [];

  const db = requireDb(env);
  const placeholders = ids.map(() => "?").join(",");
  const result = await db
    .prepare(
      `SELECT event_id, steam_id, status, updated_at
       FROM rsvps
       WHERE event_id IN (${placeholders})`
    )
    .bind(...ids)
    .all();

  return (result.results || []).map(rowToRsvp);
}
