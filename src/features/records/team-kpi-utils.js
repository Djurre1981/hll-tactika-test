import {
  filterMatchHistory,
  hasRecordedResult,
  summarizeMatchHistory,
} from "./match-history-utils.js";

/** Past events with a recorded win or loss, newest first. */
export function getRecordedResults(events, now = new Date()) {
  return filterMatchHistory(events, {}, now)
    .filter(hasRecordedResult)
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
}

/** Latest N results as `"win"` | `"loss"`. */
export function computeRecentForm(events, limit = 5, now = new Date()) {
  return getRecordedResults(events, now)
    .slice(0, limit)
    .map((event) => event.match.result);
}

export function formatFormLabel(form) {
  if (!form?.length) return null;
  return form.map((result) => (result === "win" ? "W" : "L")).join(" · ");
}

export function summarizeTeamKpis(events, now = new Date()) {
  const base = summarizeMatchHistory(events, now);
  const form = computeRecentForm(events, 5, now);

  return {
    ...base,
    form,
    formLabel: formatFormLabel(form),
    recordLabel:
      base.recorded > 0 ? `${base.wins}–${base.losses}` : null,
    winRateLabel: base.winRate != null ? `${base.winRate}%` : "—",
  };
}

function monthKeyFromIso(startsAt) {
  const date = new Date(startsAt);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

/** Monthly win/loss buckets for charts, oldest → newest. */
export function aggregateWinLossByMonth(events, now = new Date()) {
  const buckets = new Map();

  for (const event of getRecordedResults(events, now)) {
    const key = monthKeyFromIso(event.startsAt);
    if (!buckets.has(key)) {
      buckets.set(key, { monthKey: key, label: formatMonthLabel(key), wins: 0, losses: 0 });
    }
    const bucket = buckets.get(key);
    if (event.match.result === "win") bucket.wins += 1;
    else bucket.losses += 1;
  }

  return [...buckets.values()]
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((row) => ({
      ...row,
      total: row.wins + row.losses,
      winRate: row.wins + row.losses ? Math.round((row.wins / (row.wins + row.losses)) * 100) : null,
    }));
}

/** Win rate by map for charts, sorted by most played. */
export function aggregateWinRateByMap(events, now = new Date()) {
  const buckets = new Map();

  for (const event of getRecordedResults(events, now)) {
    const mapId = String(event.match?.mapId || "").trim() || "Unknown map";
    if (!buckets.has(mapId)) {
      buckets.set(mapId, { mapId, wins: 0, losses: 0 });
    }
    const bucket = buckets.get(mapId);
    if (event.match.result === "win") bucket.wins += 1;
    else bucket.losses += 1;
  }

  return [...buckets.values()]
    .map((row) => {
      const total = row.wins + row.losses;
      return {
        ...row,
        total,
        winRate: total ? Math.round((row.wins / total) * 100) : null,
      };
    })
    .sort((a, b) => b.total - a.total || a.mapId.localeCompare(b.mapId));
}

/** Win rate by opponent for charts, sorted by most played. */
export function aggregateWinRateByOpponent(events, now = new Date()) {
  const buckets = new Map();

  for (const event of getRecordedResults(events, now)) {
    const opponent = String(event.match?.opponent || "").trim() || "Unknown opponent";
    if (!buckets.has(opponent)) {
      buckets.set(opponent, { opponent, wins: 0, losses: 0 });
    }
    const bucket = buckets.get(opponent);
    if (event.match.result === "win") bucket.wins += 1;
    else bucket.losses += 1;
  }

  return [...buckets.values()]
    .map((row) => {
      const total = row.wins + row.losses;
      return {
        ...row,
        total,
        winRate: total ? Math.round((row.wins / total) * 100) : null,
      };
    })
    .sort((a, b) => b.total - a.total || a.opponent.localeCompare(b.opponent))
    .slice(0, 8);
}
