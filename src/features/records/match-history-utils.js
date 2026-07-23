import { FACTION_LABELS, RESULT_LABELS, isMatchEventType } from "../calendar/calendar-utils.js";

/** Event start is before now (strictly in the past). */
export function isPastEvent(event, now = new Date()) {
  const start = Date.parse(event?.startsAt);
  if (!Number.isFinite(start)) return false;
  return start < now.getTime();
}

/** Win or loss recorded on event match metadata. */
export function hasRecordedResult(event) {
  const result = String(event?.match?.result || "").trim();
  return result === "win" || result === "loss";
}

/** Past scrim/comp or any past event with a recorded result. */
export function isMatchHistoryEntry(event, now = new Date()) {
  if (!isPastEvent(event, now)) return false;
  if (hasRecordedResult(event)) return true;
  return isMatchEventType(event?.eventType);
}

export function filterMatchHistory(events, filters = {}, now = new Date()) {
  let list = (events || []).filter((event) => isMatchHistoryEntry(event, now));

  if (filters.result) {
    list = list.filter((event) => String(event.match?.result || "") === filters.result);
  }

  if (filters.mapId) {
    list = list.filter((event) => String(event.match?.mapId || "") === filters.mapId);
  }

  if (filters.eventType) {
    list = list.filter((event) => String(event.eventType || "") === filters.eventType);
  }

  const opponentQuery = String(filters.opponent || "").trim().toLowerCase();
  if (opponentQuery) {
    list = list.filter((event) =>
      String(event.match?.opponent || "").toLowerCase().includes(opponentQuery)
    );
  }

  const steamId = String(filters.participantSteamId || "").trim();
  if (steamId) {
    list = list.filter((event) => eventHasParticipant(event, steamId));
  }

  return list.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
}

/** True when event.match.participantSteamIds includes this Steam ID64. */
export function eventHasParticipant(event, steamId) {
  const id = String(steamId || "").trim();
  if (!id) return false;
  const list = event?.match?.participantSteamIds;
  if (!Array.isArray(list)) return false;
  return list.some((entry) => String(entry) === id);
}

export function countParticipantMatches(events, steamId, now = new Date()) {
  if (!steamId) return 0;
  return filterMatchHistory(events, { participantSteamId: steamId }, now).length;
}

export function uniqueMapIds(events) {
  const ids = new Set();
  for (const event of events || []) {
    const mapId = String(event.match?.mapId || "").trim();
    if (mapId) ids.add(mapId);
  }
  return [...ids].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function summarizeMatchHistory(events, now = new Date()) {
  const entries = filterMatchHistory(events, {}, now);
  const withResult = entries.filter(hasRecordedResult);
  const wins = withResult.filter((event) => event.match.result === "win").length;
  const losses = withResult.filter((event) => event.match.result === "loss").length;
  const total = withResult.length;

  return {
    entries: entries.length,
    recorded: total,
    wins,
    losses,
    winRate: total ? Math.round((wins / total) * 100) : null,
  };
}

export function formatHistoryEventWhen(startsAt) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startsAt));
}

export function historyResultLabel(result) {
  if (!result) return "No result";
  return RESULT_LABELS[result] || result;
}

export function historyResultClass(result) {
  if (result === "win") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (result === "loss") return "border-red-400/30 bg-red-500/10 text-red-200";
  return "border-white/10 bg-white/[0.04] text-white/45";
}

export function historyEventTypeLabel(eventType) {
  const labels = {
    scrim: "Scrim",
    comp: "Comp",
    practice: "Practice",
    other: "Other",
  };
  return labels[eventType] || eventType || "Event";
}

export function historyMatchLine(event) {
  const match = event?.match || {};
  const parts = [];
  if (match.opponent) parts.push(`vs ${match.opponent}`);
  if (match.mapId) parts.push(match.mapId);
  if (match.faction) parts.push(FACTION_LABELS[match.faction] || match.faction);
  return parts.join(" · ");
}
