import { requireDb } from "./d1.js";

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toFloat(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rowToStat(row) {
  return {
    eventId: row.event_id,
    steamId: row.steam_id,
    side: row.side || null,
    displayName: row.display_name || null,
    kills: toInt(row.kills),
    deaths: toInt(row.deaths),
    combatPoints: toInt(row.combat_points),
    supportPoints: toInt(row.support_points),
    offensivePoints: toInt(row.offensive_points),
    defensivePoints: toInt(row.defensive_points),
    playtimeSeconds: toInt(row.playtime_seconds),
    kpm: toFloat(row.kpm),
    source: row.source || "helo",
    updatedAt: row.updated_at,
  };
}

/**
 * Normalize a HeLO player_stats row into a slim snapshot.
 * @param {string} steamId
 * @param {object} row
 * @param {{ eventId: string, source?: string }} meta
 */
export function slimHeloPlayerStat(steamId, row, meta) {
  if (!row || typeof row !== "object") return null;
  const id = String(steamId || "").trim();
  if (!/^\d{17}$/.test(id)) return null;

  return {
    eventId: meta.eventId,
    steamId: id,
    side: String(row.side || "").trim() || null,
    displayName: String(row.name || "").trim().slice(0, 120) || null,
    kills: toInt(row.kills),
    deaths: toInt(row.deaths),
    combatPoints: toInt(row.combat_points),
    supportPoints: toInt(row.support_points),
    offensivePoints: toInt(row.offensive_points),
    defensivePoints: toInt(row.defensive_points),
    playtimeSeconds: toInt(row.playtime),
    kpm: toFloat(row.kpm),
    source: meta.source || "helo",
  };
}

/**
 * Extract Circle-side slim stats from a HeLO match payload.
 * @param {object} heloMatch
 * @param {string} eventId
 * @param {"axis"|"allies"|string} faction
 */
export function extractCircleSlimStats(heloMatch, eventId, faction) {
  const sideWanted =
    faction === "axis" ? "Axis" : faction === "allies" ? "Allies" : "";
  const stats = heloMatch?.player_stats;
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) return [];

  const out = [];
  for (const [steamId, row] of Object.entries(stats)) {
    if (sideWanted && String(row?.side || "") !== sideWanted) continue;
    const slim = slimHeloPlayerStat(steamId, row, { eventId, source: "helo" });
    if (slim) out.push(slim);
  }
  return out;
}

/**
 * Normalize a CRCON scoreboard player row.
 * @param {object} row
 * @param {{ eventId: string, faction?: string }} meta
 */
export function slimCrconPlayerStat(row, meta) {
  const steamId = String(row?.player_id || row?.steam_id || row?.steamId || "").trim();
  if (!/^\d{17}$/.test(steamId)) return null;

  const team = String(row?.team || row?.side || row?.faction || "")
    .trim()
    .toLowerCase();
  let side = null;
  if (team === "axis" || team === "ger" || team === "germany") side = "Axis";
  else if (team === "allies" || team === "allied" || team === "us" || team === "usa") side = "Allies";

  if (meta.faction === "axis" && side && side !== "Axis") return null;
  if (meta.faction === "allies" && side && side !== "Allies") return null;

  return {
    eventId: meta.eventId,
    steamId,
    side,
    displayName: String(row?.name || row?.player || "").trim().slice(0, 120) || null,
    kills: toInt(row?.kills),
    deaths: toInt(row?.deaths),
    combatPoints: toInt(row?.combat || row?.combat_points),
    supportPoints: toInt(row?.support || row?.support_points),
    offensivePoints: toInt(row?.offense || row?.offensive_points),
    defensivePoints: toInt(row?.defense || row?.defensive_points),
    playtimeSeconds: toInt(row?.playtime || row?.time),
    kpm: toFloat(row?.kpm),
    source: "crcon",
  };
}

export async function upsertPlayerMatchStats(env, stats) {
  const list = (stats || []).filter(Boolean);
  if (!list.length) return { written: 0 };

  const db = requireDb(env);
  const now = new Date().toISOString();
  const stmts = list.map((stat) =>
    db
      .prepare(
        `INSERT INTO player_match_stats (
          event_id, steam_id, side, display_name, kills, deaths,
          combat_points, support_points, offensive_points, defensive_points,
          playtime_seconds, kpm, source, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_id, steam_id) DO UPDATE SET
          side = excluded.side,
          display_name = excluded.display_name,
          kills = excluded.kills,
          deaths = excluded.deaths,
          combat_points = excluded.combat_points,
          support_points = excluded.support_points,
          offensive_points = excluded.offensive_points,
          defensive_points = excluded.defensive_points,
          playtime_seconds = excluded.playtime_seconds,
          kpm = excluded.kpm,
          source = excluded.source,
          updated_at = excluded.updated_at`
      )
      .bind(
        stat.eventId,
        stat.steamId,
        stat.side,
        stat.displayName,
        toInt(stat.kills),
        toInt(stat.deaths),
        toInt(stat.combatPoints),
        toInt(stat.supportPoints),
        toInt(stat.offensivePoints),
        toInt(stat.defensivePoints),
        toInt(stat.playtimeSeconds),
        toFloat(stat.kpm),
        stat.source || "helo",
        now
      )
  );

  await db.batch(stmts);
  return { written: list.length };
}

export async function listPlayerMatchStatsForEvent(env, eventId) {
  const db = requireDb(env);
  const result = await db
    .prepare(
      `SELECT event_id, steam_id, side, display_name, kills, deaths,
              combat_points, support_points, offensive_points, defensive_points,
              playtime_seconds, kpm, source, updated_at
       FROM player_match_stats
       WHERE event_id = ?
       ORDER BY combat_points DESC, kills DESC`
    )
    .bind(eventId)
    .all();
  return (result.results || []).map(rowToStat);
}

export async function listPlayerMatchStatsForSteamIds(env, steamIds, { limitEvents = 60 } = {}) {
  const ids = [...new Set((steamIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!ids.length) return [];

  const db = requireDb(env);
  const placeholders = ids.map(() => "?").join(",");
  const result = await db
    .prepare(
      `SELECT pms.event_id, pms.steam_id, pms.side, pms.display_name, pms.kills, pms.deaths,
              pms.combat_points, pms.support_points, pms.offensive_points, pms.defensive_points,
              pms.playtime_seconds, pms.kpm, pms.source, pms.updated_at
       FROM player_match_stats pms
       INNER JOIN events e ON e.id = pms.event_id
       WHERE pms.steam_id IN (${placeholders})
       ORDER BY e.starts_at DESC
       LIMIT ?`
    )
    .bind(...ids, Math.max(1, limitEvents * Math.max(ids.length, 1)))
    .all();

  return (result.results || []).map(rowToStat);
}

/** Aggregate combat totals keyed by steamId. */
export function aggregateCombatBySteamId(stats = []) {
  const map = {};
  for (const row of stats) {
    const id = row.steamId;
    if (!map[id]) {
      map[id] = {
        steamId: id,
        kills: 0,
        deaths: 0,
        combatPoints: 0,
        supportPoints: 0,
        matches: 0,
      };
    }
    map[id].kills += row.kills || 0;
    map[id].deaths += row.deaths || 0;
    map[id].combatPoints += row.combatPoints || 0;
    map[id].supportPoints += row.supportPoints || 0;
    map[id].matches += 1;
  }
  return map;
}
