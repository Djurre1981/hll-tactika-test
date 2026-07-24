import { requireDb } from "./d1.js";
import { buildDefaultLayout, sanitizeRosterSize } from "./lineup-layouts.js";
import { isLineupAutoLocked, validateLineupLayout } from "./lineup-validate.js";
import { getEvent, mutateEventComponent, updateEvent } from "./events-store.js";
import { listRsvpsForEvent } from "./rsvps-store.js";

function parseLayout(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function rowToLineup(row, event = null) {
  const layout = parseLayout(row.layout_json) || {};
  const lineup = {
    id: row.id,
    eventId: row.event_id,
    rosterSize: Number(row.roster_size),
    locked: Boolean(row.locked),
    lockedBy: row.locked_by || null,
    lockedAt: row.locked_at || null,
    layout,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  lineup.effectivelyLocked = isLineupAutoLocked(lineup, event);
  return lineup;
}

const SELECT =
  "id, event_id, roster_size, locked, locked_by, locked_at, layout_json, created_by, created_at, updated_at";

export async function getLineup(env, lineupId) {
  const db = requireDb(env);
  const row = await db
    .prepare(`SELECT ${SELECT} FROM lineups WHERE id = ?`)
    .bind(lineupId)
    .first();
  if (!row) return null;
  const event = await getEvent(env, row.event_id);
  return rowToLineup(row, event);
}

export async function getLineupByEventId(env, eventId) {
  const db = requireDb(env);
  const row = await db
    .prepare(`SELECT ${SELECT} FROM lineups WHERE event_id = ?`)
    .bind(eventId)
    .first();
  if (!row) return null;
  const event = await getEvent(env, eventId);
  return rowToLineup(row, event);
}

async function confirmedIdsForEvent(env, eventId) {
  const rsvps = await listRsvpsForEvent(env, eventId);
  return new Set(
    (rsvps || [])
      .filter((r) => r.status === "confirmed")
      .map((r) => String(r.steamId))
  );
}

/**
 * Create a lineup for an event (or return existing) and attach to components.lineupId.
 * Admin-only at API layer.
 */
export async function createLineupForEvent(env, eventId, { createdBy, rosterSize } = {}) {
  const event = await getEvent(env, eventId);
  if (!event) return { error: "Event not found", status: 404 };

  const existing = await getLineupByEventId(env, eventId);
  if (existing) {
    if (event.components?.lineupId !== existing.id) {
      await mutateEventComponent(env, eventId, {
        action: "attach",
        type: "lineup",
        id: existing.id,
      });
    }
    return { lineup: existing, created: false };
  }

  const sizeRaw =
    rosterSize != null
      ? rosterSize
      : event.rosterSize != null
        ? event.rosterSize
        : 36;
  const sizeCheck = sanitizeRosterSize(sizeRaw);
  if (sizeCheck.error) return { error: sizeCheck.error, status: 400 };

  if (event.rosterSize !== sizeCheck.rosterSize) {
    const updated = await updateEvent(env, eventId, { rosterSize: sizeCheck.rosterSize });
    if (updated?.error) return updated;
  }

  const now = new Date().toISOString();
  const id = `lineup-${crypto.randomUUID()}`;
  const layout = buildDefaultLayout(sizeCheck.rosterSize);
  const db = requireDb(env);

  await db
    .prepare(
      `INSERT INTO lineups
       (id, event_id, roster_size, locked, locked_by, locked_at, layout_json, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 0, NULL, NULL, ?, ?, ?, ?)`
    )
    .bind(
      id,
      eventId,
      sizeCheck.rosterSize,
      JSON.stringify(layout),
      createdBy,
      now,
      now
    )
    .run();

  const attach = await mutateEventComponent(env, eventId, {
    action: "attach",
    type: "lineup",
    id,
  });
  if (attach?.error) return attach;

  const lineup = await getLineup(env, id);
  return { lineup, created: true };
}

export async function saveLineupLayout(env, lineupId, layout, { actorSteamId } = {}) {
  const existing = await getLineup(env, lineupId);
  if (!existing) return { error: "Lineup not found", status: 404 };

  const event = await getEvent(env, existing.eventId);
  if (!event) return { error: "Event not found", status: 404 };

  if (isLineupAutoLocked(existing, event)) {
    return { error: "Lineup is locked", status: 423 };
  }

  const confirmed = await confirmedIdsForEvent(env, existing.eventId);
  const valid = validateLineupLayout(layout, {
    rosterSize: existing.rosterSize,
    confirmedSteamIds: confirmed,
  });
  if (valid.error) return valid;

  const now = new Date().toISOString();
  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE lineups SET layout_json = ?, updated_at = ? WHERE id = ?`
    )
    .bind(JSON.stringify(layout), now, lineupId)
    .run();

  void actorSteamId;
  return { lineup: await getLineup(env, lineupId) };
}

export async function lockLineup(env, lineupId, steamId) {
  const existing = await getLineup(env, lineupId);
  if (!existing) return { error: "Lineup not found", status: 404 };

  const now = new Date().toISOString();
  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE lineups SET locked = 1, locked_by = ?, locked_at = ?, updated_at = ? WHERE id = ?`
    )
    .bind(steamId, now, now, lineupId)
    .run();

  return { lineup: await getLineup(env, lineupId) };
}

export async function unlockLineup(env, lineupId) {
  const existing = await getLineup(env, lineupId);
  if (!existing) return { error: "Lineup not found", status: 404 };

  const event = await getEvent(env, existing.eventId);
  if (event?.endsAt && Date.parse(event.endsAt) <= Date.now()) {
    return {
      error: "Cannot unlock after match end time (auto-lock)",
      status: 423,
    };
  }

  const now = new Date().toISOString();
  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE lineups SET locked = 0, locked_by = NULL, locked_at = NULL, updated_at = ? WHERE id = ?`
    )
    .bind(now, lineupId)
    .run();

  return { lineup: await getLineup(env, lineupId) };
}

export async function deleteLineup(env, lineupId) {
  const existing = await getLineup(env, lineupId);
  if (!existing) return { error: "Lineup not found", status: 404 };

  if (existing.eventId) {
    await mutateEventComponent(env, existing.eventId, {
      action: "detach",
      type: "lineup",
      id: lineupId,
    });
  }

  const db = requireDb(env);
  await db.prepare("DELETE FROM lineups WHERE id = ?").bind(lineupId).run();
  return { ok: true, lineup: existing };
}
