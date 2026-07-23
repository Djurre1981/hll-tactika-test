import {
  filterMatchHistory,
  formatHistoryEventWhen,
  hasRecordedResult,
  historyMatchLine,
} from "../records/match-history-utils.js";

/**
 * Build a player dossier from calendar history + optional combat aggregates.
 * Used by Management PlayerCard and Overview profile drawer.
 */
export function buildPlayerDossier(member, events, combatBySteamId = {}, now = new Date()) {
  const steamId = String(member?.steamId || "").trim();
  const history = steamId
    ? filterMatchHistory(events, { participantSteamId: steamId }, now)
    : [];

  const withResult = history.filter(hasRecordedResult);
  const wins = withResult.filter((e) => e.match.result === "win").length;
  const losses = withResult.filter((e) => e.match.result === "loss").length;
  const recorded = wins + losses;
  const combat = steamId ? combatBySteamId[steamId] || null : null;

  const last = history[0] || null;
  const matches = history.slice(0, 12).map((event) => ({
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    when: formatHistoryEventWhen(event.startsAt),
    line: historyMatchLine(event),
    result: event.match?.result || null,
    opponent: event.match?.opponent || null,
    mapId: event.match?.mapId || null,
  }));

  return {
    steamId: steamId || null,
    gamesPlayed: history.length,
    wins,
    losses,
    winRate: recorded ? Math.round((wins / recorded) * 100) : null,
    recordLabel: recorded ? `${wins}–${losses}` : null,
    kills: combat?.kills ?? null,
    deaths: combat?.deaths ?? null,
    combatPoints: combat?.combatPoints ?? null,
    matchesWithStats: combat?.matches ?? null,
    kd:
      combat && combat.deaths > 0
        ? Math.round((combat.kills / combat.deaths) * 100) / 100
        : combat && combat.kills > 0
          ? combat.kills
          : null,
    lastGame: last
      ? {
          id: last.id,
          title: last.title,
          when: formatHistoryEventWhen(last.startsAt),
          line: historyMatchLine(last),
          result: last.match?.result || null,
        }
      : null,
    matches,
  };
}
