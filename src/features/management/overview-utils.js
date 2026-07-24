import { isPoolStatus } from "./rosterRoles.js";
import {
  eventHasParticipant,
  filterMatchHistory,
  hasRecordedResult,
} from "../records/match-history-utils.js";
import { summarizeTeamKpis } from "../records/team-kpi-utils.js";

export const PULSE_PERIODS = [
  { id: "30d", label: "30 days", shortLabel: "30d" },
  { id: "year", label: "1 year", shortLabel: "1y" },
  { id: "all", label: "All-time", shortLabel: "All" },
];

/** Filter past events to a rolling window. `all` keeps everything passed in. */
export function filterEventsByPeriod(events, periodId = "30d", now = new Date()) {
  const list = events || [];
  if (periodId === "all") return list;
  const days = periodId === "year" ? 365 : 30;
  const cutoff = now.getTime() - days * 86_400_000;
  return list.filter((event) => {
    const start = Date.parse(event?.startsAt);
    return Number.isFinite(start) && start >= cutoff && start <= now.getTime();
  });
}

/** Count linked tools on an event components object. */
export function countLinkedTools(components) {
  if (!components || typeof components !== "object") return 0;
  const strats = Array.isArray(components.stratIds) ? components.stratIds.length : 0;
  const routes = Array.isArray(components.routePlanIds) ? components.routePlanIds.length : 0;
  const boards = Array.isArray(components.whiteboardIds) ? components.whiteboardIds.length : 0;
  const roster = components.rosterId ? 1 : 0;
  return strats + routes + boards + roster;
}

/**
 * Readiness score 0–100 for an upcoming event.
 * Weights: tools 35, open prep tasks 35, RSVP confirmed vs target (or responses) 30.
 */
export function computeEventReadiness(
  event,
  { openPrepCount = 0, rsvpCounts = null, seats = null } = {}
) {
  const tools = countLinkedTools(event?.components);
  const toolScore = Math.min(1, tools / 3) * 35;

  const prepScore =
    openPrepCount <= 0 ? 35 : Math.max(0, 35 - Math.min(35, openPrepCount * 8));

  let rsvpScore = 15;
  const target =
    seats?.target != null
      ? Number(seats.target)
      : event?.signupTarget != null
        ? Number(event.signupTarget)
        : null;

  if (rsvpCounts && typeof rsvpCounts === "object") {
    const confirmed = Number(rsvpCounts.confirmed) || 0;
    const tentative = Number(rsvpCounts.tentative) || 0;
    const waitlist = Number(rsvpCounts.waitlist) || 0;
    const declined = Number(rsvpCounts.declined) || 0;
    const unavailable = Number(rsvpCounts.unavailable) || 0;
    const maybe = tentative + waitlist;
    const total = confirmed + maybe + declined + unavailable;

    if (Number.isInteger(target) && target > 0) {
      rsvpScore = Math.min(30, (confirmed / target) * 30 + Math.min(maybe, 5));
    } else if (total > 0) {
      rsvpScore = Math.min(30, (confirmed / Math.max(total, 1)) * 30 + Math.min(maybe, 5));
    } else {
      rsvpScore = 0;
    }
  }

  return Math.round(Math.min(100, toolScore + prepScore + rsvpScore));
}

export function readinessLabel(score) {
  if (score >= 75) return "Ready";
  if (score >= 45) return "In progress";
  return "Needs prep";
}

export function readinessClass(score) {
  if (score >= 75) return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (score >= 45) return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-white/15 bg-white/[0.04] text-white/55";
}

/**
 * Rank roster members by participation in past matches (optionally period-filtered by caller).
 * Label clearly as participation (not RSVP attendance).
 */
export function buildParticipationBoard(events, members, { now = new Date() } = {}) {
  const history = filterMatchHistory(events, {}, now);
  const poolSize = history.length || 1;

  const rows = (members || [])
    .filter((m) => m?.steamId && isPoolStatus(m.status))
    .map((member) => {
      const steamId = String(member.steamId);
      const played = history.filter((event) => eventHasParticipant(event, steamId));
      const withResult = played.filter(hasRecordedResult);
      const wins = withResult.filter((e) => e.match.result === "win").length;
      const losses = withResult.filter((e) => e.match.result === "loss").length;
      const recorded = wins + losses;
      return {
        memberId: member.id,
        steamId,
        displayName: member.displayName || steamId,
        avatarUrl: member.avatarUrl || null,
        rosterRole: member.rosterRole || null,
        gamesPlayed: played.length,
        participationRate: Math.round((played.length / poolSize) * 100),
        wins,
        losses,
        winRate: recorded ? Math.round((wins / recorded) * 100) : null,
      };
    })
    .filter((row) => row.gamesPlayed > 0)
    .sort((a, b) => {
      if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
      return (b.winRate ?? -1) - (a.winRate ?? -1);
    });

  return {
    poolSize: history.length,
    rows,
    top: rows.slice(0, 5),
    bottom: [...rows].reverse().slice(0, 5),
  };
}

/** Sort direction for ranked boards: best (desc) or worst (asc). */
export function applyRankFilter(rows, rank = "best", metric = "gamesPlayed") {
  const list = [...(rows || [])];
  const dir = rank === "worst" ? 1 : -1;
  list.sort((a, b) => {
    if (metric === "benchDebt") {
      const ad = a.benchDebt ?? 0;
      const bd = b.benchDebt ?? 0;
      if (ad !== bd) return dir * (ad - bd);
      return dir * ((a.confirmedRsvpCount ?? 0) - (b.confirmedRsvpCount ?? 0));
    }
    if (metric === "winRate") {
      const aw = a.winRate ?? -1;
      const bw = b.winRate ?? -1;
      if (aw !== bw) return dir * (aw - bw) || (b.gamesPlayed - a.gamesPlayed);
      return b.gamesPlayed - a.gamesPlayed;
    }
    if (a.gamesPlayed !== b.gamesPlayed) return dir * (a.gamesPlayed - b.gamesPlayed);
    return dir * ((a.winRate ?? -1) - (b.winRate ?? -1));
  });
  return list;
}

/**
 * Bench debt + loyalty warning chips from lineup attendance fairness stats.
 * Score: confirmedRsvpCount - playedCount (fallback reserveCount when confirmed is 0).
 * Warnings: chronic bench, loyal unused. Ghost risk deferred (needs raincheck streak).
 */
export function buildDeservesBoard(members, statsBySteamId = {}) {
  const rows = (members || [])
    .filter((m) => m?.steamId && isPoolStatus(m.status))
    .map((member) => {
      const steamId = String(member.steamId);
      const stats = statsBySteamId[steamId] || {};
      const confirmed = Number(stats.confirmedRsvpCount) || 0;
      const played = Number(stats.playedCount) || 0;
      const reserve = Number(stats.reserveCount) || 0;
      const benchDebt = confirmed > 0 ? confirmed - played : reserve;

      const warnings = [];
      if (reserve >= 3 && reserve / Math.max(confirmed, 1) >= 0.4) {
        warnings.push({ id: "chronic", label: "Chronic bench" });
      }
      if (confirmed >= 5 && played / confirmed < 0.5) {
        warnings.push({ id: "loyal", label: "Loyal unused" });
      }
      // Ghost risk: deferred until raincheck streak window exists.

      return {
        memberId: member.id,
        steamId,
        displayName: member.displayName || steamId,
        avatarUrl: member.avatarUrl || null,
        rosterRole: member.rosterRole || null,
        confirmedRsvpCount: confirmed,
        playedCount: played,
        reserveCount: reserve,
        benchDebt,
        warnings,
      };
    })
    .filter((row) => row.confirmedRsvpCount > 0 || row.reserveCount > 0 || row.playedCount > 0)
    .sort((a, b) => {
      if (b.benchDebt !== a.benchDebt) return b.benchDebt - a.benchDebt;
      return b.confirmedRsvpCount - a.confirmedRsvpCount;
    });

  return { rows };
}

/** Merge combat aggregates onto participation rows when stats are available. */
export function mergeCombatIntoFormBoard(participationRows, combatBySteamId = {}) {
  return (participationRows || []).map((row) => {
    const combat = combatBySteamId[row.steamId] || null;
    return {
      ...row,
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
    };
  });
}

/**
 * Split form board into hot (best win rate) and cold (worst) among players
 * with enough recorded results.
 */
export function splitFormBoard(rows, { minGames = 3, limit = 5 } = {}) {
  const eligible = (rows || []).filter(
    (row) => row.gamesPlayed >= minGames && row.winRate != null && row.wins + row.losses >= 2
  );
  const byWinRate = [...eligible].sort((a, b) => {
    if ((b.winRate ?? -1) !== (a.winRate ?? -1)) return (b.winRate ?? -1) - (a.winRate ?? -1);
    return b.gamesPlayed - a.gamesPlayed;
  });
  const hot = byWinRate.slice(0, limit);
  const hotIds = new Set(hot.map((r) => r.steamId));
  const cold = [...byWinRate].reverse().filter((r) => !hotIds.has(r.steamId)).slice(0, limit);

  // Fallback when few recorded results: use participation volume.
  if (!hot.length && (rows || []).length) {
    const byGames = [...rows].sort((a, b) => b.gamesPlayed - a.gamesPlayed);
    return {
      hot: byGames.slice(0, limit),
      cold: [...byGames].reverse().slice(0, limit).filter((r) => r.steamId !== byGames[0]?.steamId),
    };
  }

  return { hot, cold };
}

export function buildSeasonPulse(events, upcomingEvents = [], now = new Date()) {
  const kpis = summarizeTeamKpis(events, now);
  const next = (upcomingEvents || [])[0] || null;
  return {
    ...kpis,
    nextOpponent: next?.match?.opponent || null,
    nextEventId: next?.id || null,
    nextTitle: next?.title || null,
    nextStartsAt: next?.startsAt || null,
  };
}

export function formatCountdown(startsAt, now = new Date()) {
  const start = Date.parse(startsAt);
  if (!Number.isFinite(start)) return null;
  const diffMs = start - now.getTime();
  if (diffMs <= 0) return "Started";
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days >= 2) return `in ${days}d`;
  if (hours >= 24) return `in ${days}d ${hours % 24}h`;
  if (hours >= 1) return `in ${hours}h`;
  const mins = Math.max(1, Math.floor(diffMs / 60_000));
  return `in ${mins}m`;
}

export function formatEventWhen(startsAt) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startsAt));
}

export const RSVP_STATUSES = [
  "confirmed",
  "tentative",
  "declined",
  "unavailable",
  "waitlist",
];

export function emptyRsvpCounts() {
  return {
    confirmed: 0,
    tentative: 0,
    declined: 0,
    unavailable: 0,
    waitlist: 0,
    total: 0,
  };
}

export function summarizeRsvpCounts(rsvps = []) {
  const counts = emptyRsvpCounts();
  for (const row of rsvps) {
    const status = String(row?.status || "").trim();
    if (RSVP_STATUSES.includes(status)) {
      counts[status] += 1;
      counts.total += 1;
    }
  }
  return counts;
}

/** Role coverage depth for active roster members. */
export function buildRoleDepth(members) {
  const depth = new Map();
  for (const member of members || []) {
    if (!isPoolStatus(member.status)) continue;
    const roles = Array.isArray(member.rosterRoles) && member.rosterRoles.length
      ? member.rosterRoles
      : member.rosterRole
        ? [member.rosterRole]
        : ["unassigned"];
    for (const role of roles) {
      const key = String(role || "unassigned");
      depth.set(key, (depth.get(key) || 0) + 1);
    }
  }
  return [...depth.entries()]
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count || a.role.localeCompare(b.role));
}
