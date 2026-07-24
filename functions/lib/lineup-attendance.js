import { requireDb } from "./d1.js";
import { listRsvpsForEvent } from "./rsvps-store.js";

function collectPlayingSteamIds(layout) {
  const ids = new Set();
  for (const sp of layout?.specials || []) {
    if (sp.role === "streamer") continue;
    if (sp.steamId) ids.add(String(sp.steamId));
  }
  for (const sec of layout?.sectors || []) {
    for (const sq of sec.squads || []) {
      for (const slot of sq.slots || []) {
        if (slot.steamId) ids.add(String(slot.steamId));
      }
    }
  }
  return ids;
}

/**
 * Snapshot who confirmed / played / sat reserve for an event (idempotent upsert).
 * Call when LineUp is locked (manual or after match end finalize).
 */
export async function recordLineupAttendance(env, { eventId, layout }) {
  const db = requireDb(env);
  const now = new Date().toISOString();
  const rsvps = await listRsvpsForEvent(env, eventId);
  const confirmed = (rsvps || []).filter((r) => r.status === "confirmed");
  const playing = collectPlayingSteamIds(layout);
  const reserve = new Set(
    (layout?.reserves || [])
      .map((r) => (r?.steamId ? String(r.steamId) : ""))
      .filter(Boolean)
  );

  const bySteam = new Map();
  for (const r of confirmed) {
    const id = String(r.steamId);
    bySteam.set(id, {
      steamId: id,
      wasConfirmed: 1,
      wasPlaying: playing.has(id) ? 1 : 0,
      wasReserve: reserve.has(id) ? 1 : 0,
    });
  }
  for (const id of playing) {
    if (!bySteam.has(id)) {
      bySteam.set(id, {
        steamId: id,
        wasConfirmed: 0,
        wasPlaying: 1,
        wasReserve: 0,
      });
    }
  }
  for (const id of reserve) {
    if (!bySteam.has(id)) {
      bySteam.set(id, {
        steamId: id,
        wasConfirmed: 0,
        wasPlaying: 0,
        wasReserve: 1,
      });
    } else {
      bySteam.get(id).wasReserve = 1;
    }
  }

  await db
    .prepare("DELETE FROM player_lineup_attendance WHERE event_id = ?")
    .bind(eventId)
    .run();

  for (const row of bySteam.values()) {
    await db
      .prepare(
        `INSERT INTO player_lineup_attendance
         (event_id, steam_id, was_confirmed, was_playing, was_reserve, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        eventId,
        row.steamId,
        row.wasConfirmed,
        row.wasPlaying,
        row.wasReserve,
        now
      )
      .run();
  }

  return { count: bySteam.size };
}

/** Lifetime fairness stats for a set of Steam IDs. */
export async function getAttendanceStatsForSteamIds(env, steamIds) {
  const ids = [...new Set((steamIds || []).map(String).filter(Boolean))];
  if (!ids.length) return {};

  const db = requireDb(env);
  const out = {};
  for (const id of ids) {
    out[id] = {
      steamId: id,
      confirmedRsvpCount: 0,
      reserveCount: 0,
      playedCount: 0,
    };
  }

  // Confirmed RSVPs across all events
  const rsvpPlaceholders = ids.map(() => "?").join(",");
  const rsvpRows = await db
    .prepare(
      `SELECT steam_id, COUNT(*) AS n
       FROM rsvps
       WHERE status = 'confirmed' AND steam_id IN (${rsvpPlaceholders})
       GROUP BY steam_id`
    )
    .bind(...ids)
    .all();
  for (const row of rsvpRows.results || []) {
    if (out[row.steam_id]) out[row.steam_id].confirmedRsvpCount = Number(row.n) || 0;
  }

  const attRows = await db
    .prepare(
      `SELECT steam_id,
              SUM(was_reserve) AS reserve_n,
              SUM(was_playing) AS played_n
       FROM player_lineup_attendance
       WHERE steam_id IN (${rsvpPlaceholders})
       GROUP BY steam_id`
    )
    .bind(...ids)
    .all();
  for (const row of attRows.results || []) {
    if (!out[row.steam_id]) continue;
    out[row.steam_id].reserveCount = Number(row.reserve_n) || 0;
    out[row.steam_id].playedCount = Number(row.played_n) || 0;
  }

  return out;
}
