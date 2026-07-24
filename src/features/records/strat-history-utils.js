import { FACTION_LABELS, RESULT_LABELS } from "../calendar/calendar-utils.js";
import { getStartingPointLabel } from "../../shared/mapMidpoints.js";

const STRAT_TEAM_LABELS = {
  jr: "JR",
  sr: "SR",
};

const STRAT_TYPE_LABELS = {
  friendly: "Friendly",
  tournament: "Tournament",
};

/** Prefer match.date (YYYY-MM-DD), else updatedAt / createdAt. */
export function stratSortTimestamp(strat) {
  const date = String(strat?.match?.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const ms = Date.parse(`${date}T12:00:00`);
    if (Number.isFinite(ms)) return ms;
  }
  const updated = Date.parse(strat?.updatedAt || "");
  if (Number.isFinite(updated)) return updated;
  const created = Date.parse(strat?.createdAt || "");
  return Number.isFinite(created) ? created : 0;
}

export function stratHasMatchMeta(strat) {
  const match = strat?.match;
  if (!match || typeof match !== "object") return false;
  return Boolean(
    match.date
      || match.opponent
      || match.mapId
      || match.faction
      || match.startingPoint
      || match.result
  );
}

export function stratTeamId(strat) {
  const tagTeam = String(strat?.tags?.team || "").trim();
  if (tagTeam === "jr" || tagTeam === "sr") return tagTeam;
  const matchTeam = String(strat?.match?.team || "").trim();
  if (matchTeam === "jr" || matchTeam === "sr") return matchTeam;
  return "";
}

export function filterStratHistory(strats, filters = {}) {
  let list = Array.isArray(strats) ? [...strats] : [];

  const query = String(filters.query || "").trim().toLowerCase();
  if (query) {
    list = list.filter((strat) => {
      const haystack = [
        strat.title,
        strat.match?.opponent,
        strat.match?.mapId,
        strat.notes,
        strat.tags?.team,
        strat.tags?.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  if (filters.team) {
    list = list.filter((strat) => stratTeamId(strat) === filters.team);
  }

  if (filters.stratType) {
    list = list.filter(
      (strat) => String(strat.tags?.type || "").trim() === filters.stratType
    );
  }

  if (filters.result) {
    list = list.filter(
      (strat) => String(strat.match?.result || "").trim() === filters.result
    );
  }

  if (filters.mapId) {
    list = list.filter(
      (strat) => String(strat.match?.mapId || "").trim() === filters.mapId
    );
  }

  if (filters.faction) {
    list = list.filter(
      (strat) => String(strat.match?.faction || "").trim() === filters.faction
    );
  }

  if (filters.startingPoint) {
    list = list.filter(
      (strat) =>
        String(strat.match?.startingPoint || "").trim() === filters.startingPoint
    );
  }

  if (filters.hasMatchMeta) {
    list = list.filter(stratHasMatchMeta);
  }

  return sortStratHistory(list, filters.sort || "date_desc");
}

export function sortStratHistory(strats, sort = "date_desc") {
  const list = [...(strats || [])];
  const cmpText = (a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

  switch (sort) {
    case "date_asc":
      return list.sort((a, b) => stratSortTimestamp(a) - stratSortTimestamp(b));
    case "latest":
      return list.sort(
        (a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0)
      );
    case "oldest_updated":
      return list.sort(
        (a, b) => Date.parse(a.updatedAt || 0) - Date.parse(b.updatedAt || 0)
      );
    case "opponent":
      return list.sort((a, b) =>
        cmpText(String(a.match?.opponent || ""), String(b.match?.opponent || ""))
          || stratSortTimestamp(b) - stratSortTimestamp(a)
      );
    case "faction":
      return list.sort((a, b) =>
        cmpText(String(a.match?.faction || ""), String(b.match?.faction || ""))
          || stratSortTimestamp(b) - stratSortTimestamp(a)
      );
    case "map":
      return list.sort((a, b) =>
        cmpText(String(a.match?.mapId || ""), String(b.match?.mapId || ""))
          || stratSortTimestamp(b) - stratSortTimestamp(a)
      );
    case "strongpoint":
      return list.sort((a, b) =>
        cmpText(
          String(a.match?.startingPoint || ""),
          String(b.match?.startingPoint || "")
        )
          || stratSortTimestamp(b) - stratSortTimestamp(a)
      );
    case "title":
      return list.sort((a, b) =>
        cmpText(String(a.title || ""), String(b.title || ""))
          || stratSortTimestamp(b) - stratSortTimestamp(a)
      );
    case "team":
      return list.sort((a, b) =>
        cmpText(stratTeamId(a), stratTeamId(b))
          || stratSortTimestamp(b) - stratSortTimestamp(a)
      );
    case "date_desc":
    default:
      return list.sort((a, b) => stratSortTimestamp(b) - stratSortTimestamp(a));
  }
}

export function uniqueStratMapIds(strats) {
  const ids = new Set();
  for (const strat of strats || []) {
    const mapId = String(strat.match?.mapId || "").trim();
    if (mapId) ids.add(mapId);
  }
  return [...ids].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function uniqueStratStrongpoints(strats) {
  /** @type {Map<string, { value: string, label: string }>} */
  const byId = new Map();
  for (const strat of strats || []) {
    const id = String(strat.match?.startingPoint || "").trim();
    if (!id || byId.has(id)) continue;
    const mapId = String(strat.match?.mapId || "").trim();
    const label = getStartingPointLabel(mapId, id) || id;
    byId.set(id, { value: id, label: mapId ? `${label} (${mapId})` : label });
  }
  return [...byId.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  );
}

export function summarizeStratHistory(strats) {
  const list = strats || [];
  const withMeta = list.filter(stratHasMatchMeta);
  const withResult = list.filter((s) => {
    const result = String(s.match?.result || "").trim();
    return result === "win" || result === "loss";
  });
  const wins = withResult.filter((s) => s.match.result === "win").length;
  const losses = withResult.filter((s) => s.match.result === "loss").length;
  const recorded = wins + losses;

  return {
    entries: list.length,
    withMeta: withMeta.length,
    recorded,
    wins,
    losses,
    winRate: recorded ? Math.round((wins / recorded) * 100) : null,
  };
}

export function formatStratHistoryWhen(strat) {
  const date = String(strat?.match?.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${date}T12:00:00`));
  }
  const updated = Date.parse(strat?.updatedAt || "");
  if (Number.isFinite(updated)) {
    return `Updated ${new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(updated))}`;
  }
  return "No date";
}

export function stratHistoryTeamLabel(team) {
  return STRAT_TEAM_LABELS[team] || team || "—";
}

export function stratHistoryTypeLabel(type) {
  return STRAT_TYPE_LABELS[type] || type || "Strat";
}

export function stratHistoryResultLabel(result) {
  if (!result) return "No result";
  return RESULT_LABELS[result] || result;
}

export function stratHistoryResultClass(result) {
  if (result === "win") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (result === "loss") return "border-red-400/30 bg-red-500/10 text-red-200";
  return "border-white/10 bg-white/[0.04] text-white/45";
}

export function stratHistoryLine(strat) {
  const match = strat?.match || {};
  const parts = [];
  const team = stratTeamId(strat);
  if (team) parts.push(stratHistoryTeamLabel(team));
  if (match.opponent) parts.push(`vs ${match.opponent}`);
  if (match.mapId) parts.push(match.mapId);
  if (match.faction) parts.push(FACTION_LABELS[match.faction] || match.faction);
  if (match.startingPoint) {
    const label = getStartingPointLabel(match.mapId, match.startingPoint);
    if (label) parts.push(label);
  }
  return parts.join(" · ");
}

export const STRAT_HISTORY_SORT_OPTIONS = [
  { value: "date_desc", label: "Match date (newest)" },
  { value: "date_asc", label: "Match date (oldest)" },
  { value: "latest", label: "Latest updated" },
  { value: "oldest_updated", label: "Oldest updated" },
  { value: "title", label: "Title" },
  { value: "opponent", label: "Opponent" },
  { value: "map", label: "Map" },
  { value: "faction", label: "Faction" },
  { value: "strongpoint", label: "Strongpoint" },
  { value: "team", label: "Team" },
];
