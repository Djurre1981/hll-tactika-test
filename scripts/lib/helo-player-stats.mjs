/**
 * Slim HeLO / CRCON player combat snapshots for D1 player_match_stats.
 */

export function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function toFloat(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

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

export function slimStatToInsertSql(stat, updatedAt = new Date().toISOString()) {
  const esc = (value) => {
    if (value == null) return "NULL";
    return `'${String(value).replace(/'/g, "''")}'`;
  };
  const kpm = stat.kpm == null ? "NULL" : Number(stat.kpm);
  return `INSERT INTO player_match_stats (
    event_id, steam_id, side, display_name, kills, deaths,
    combat_points, support_points, offensive_points, defensive_points,
    playtime_seconds, kpm, source, updated_at
  ) VALUES (
    ${esc(stat.eventId)},
    ${esc(stat.steamId)},
    ${esc(stat.side)},
    ${esc(stat.displayName)},
    ${toInt(stat.kills)},
    ${toInt(stat.deaths)},
    ${toInt(stat.combatPoints)},
    ${toInt(stat.supportPoints)},
    ${toInt(stat.offensivePoints)},
    ${toInt(stat.defensivePoints)},
    ${toInt(stat.playtimeSeconds)},
    ${kpm},
    ${esc(stat.source || "helo")},
    ${esc(updatedAt)}
  )
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
    updated_at = excluded.updated_at;`;
}
