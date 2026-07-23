/**
 * Map HeLO /v3 match payloads into Tactika calendar event bodies.
 */

import {
  HELO_TEAM_TAG_SR,
  resolveCompTeam,
} from "../../functions/lib/comp-teams.js";
import { extractCircleParticipantSteamIds } from "./helo-participants.mjs";

export const HELO_BASE = "https://helo-system.de";
export const DEFAULT_TEAM_TAG = HELO_TEAM_TAG_SR;
export const DEFAULT_SERIES = "2024";

/** HeLO map names → Tactika STRAT_MAP_IDS */
export const HELO_MAP_ALIASES = {
  Hurtgen: "HurtgenV2",
  SMDM: "SMDMV2",
  SHD65V2: "SMDMV2",
  "Omaha Beach": "Omaha",
  "Elsenborn Ridge": "Elsenborn",
  "El Alamein": "ElAlamein",
};

/**
 * @param {string} heloMap
 * @returns {{ mapId: string, mapped: boolean, warned: boolean }}
 */
export function mapHeloMapId(heloMap) {
  const raw = String(heloMap || "").trim();
  if (!raw) {
    return { mapId: "", mapped: false, warned: true };
  }
  if (Object.hasOwn(HELO_MAP_ALIASES, raw)) {
    return { mapId: HELO_MAP_ALIASES[raw], mapped: true, warned: false };
  }
  return { mapId: raw, mapped: false, warned: false };
}

/**
 * @param {unknown} dateField HeLO `{ $date: number }` or number (ms)
 * @returns {Date | null}
 */
export function parseHeloDate(dateField) {
  let ms = null;
  if (dateField && typeof dateField === "object" && "$date" in dateField) {
    ms = Number(dateField.$date);
  } else if (typeof dateField === "number") {
    ms = dateField;
  } else if (typeof dateField === "string" && dateField.trim()) {
    const parsed = Date.parse(dateField);
    if (Number.isFinite(parsed)) return new Date(parsed);
  }
  if (!Number.isFinite(ms)) return null;
  if (ms < 1e12) ms *= 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @param {string[]} teams
 * @param {string} teamTag
 * @param {string} result e.g. "4-1"
 * @returns {{ circleScore: number, oppScore: number, opponent: string } | null}
 */
export function parseHeloScores(teams, teamTag, result) {
  const list = Array.isArray(teams) ? teams.map(String) : [];
  const circleIdx = list.findIndex((t) => t === teamTag);
  if (circleIdx < 0) return null;

  const parts = String(result || "").trim().split("-");
  if (parts.length !== 2) return null;
  const s0 = Number(parts[0]);
  const s1 = Number(parts[1]);
  if (!Number.isFinite(s0) || !Number.isFinite(s1)) return null;

  const circleScore = circleIdx === 0 ? s0 : s1;
  const oppScore = circleIdx === 0 ? s1 : s0;
  const opponent = list.filter((t) => t !== teamTag).join(", ") || "Unknown";
  return { circleScore, oppScore, opponent };
}

/**
 * @param {"Axis"|"Allies"|string} victorSide
 * @param {boolean} circleWon
 * @returns {"axis"|"allies"|""}
 */
export function inferCircleFaction(victorSide, circleWon) {
  const side = String(victorSide || "").trim().toLowerCase();
  if (side !== "axis" && side !== "allies") return "";
  if (circleWon) return side;
  return side === "axis" ? "allies" : "axis";
}

/**
 * @param {object} heloMatch
 * @param {{ teamTag?: string, series?: string }} [opts]
 * @returns {{
 *   event: object,
 *   warnings: string[],
 *   heloMatchId: string,
 * } | { error: string }}
 */
export function heloMatchToEvent(heloMatch, opts = {}) {
  const resolved = resolveCompTeam(opts.teamTag || DEFAULT_TEAM_TAG);
  const teamTag = resolved?.heloTag || String(opts.teamTag || DEFAULT_TEAM_TAG).trim() || DEFAULT_TEAM_TAG;
  const teamId = resolved?.id || "sr";
  const series = opts.series || DEFAULT_SERIES;
  const matchId = String(heloMatch?.match_id || "").trim();
  if (!matchId) {
    return { error: "Missing match_id" };
  }

  const warnings = [];
  const scores = parseHeloScores(heloMatch.teams, teamTag, heloMatch.result);
  if (!scores) {
    return { error: `Could not parse scores/teams for ${matchId}` };
  }

  const starts = parseHeloDate(heloMatch.date);
  if (!starts) {
    return { error: `Could not parse date for ${matchId}` };
  }

  const durationMin =
    Number.isFinite(Number(heloMatch.duration)) && Number(heloMatch.duration) > 0
      ? Number(heloMatch.duration)
      : 90;
  const ends = new Date(starts.getTime() + durationMin * 60_000);

  const circleWon = scores.circleScore > scores.oppScore;
  const result = circleWon ? "win" : scores.circleScore < scores.oppScore ? "loss" : "";
  if (!result) {
    warnings.push(`${matchId}: draw/unknown result ${heloMatch.result}`);
  }

  const faction = inferCircleFaction(heloMatch.victor_side, circleWon);
  if (!faction) {
    warnings.push(`${matchId}: could not infer faction from victor_side=${heloMatch.victor_side}`);
  }

  const { mapId, warned: mapWarned } = mapHeloMapId(heloMatch.map);
  if (mapWarned) {
    warnings.push(`${matchId}: missing map`);
  }

  const heloType = String(heloMatch.type || "").toLowerCase();
  const eventType = heloType === "competitive" ? "comp" : "scrim";
  const kindLabel = eventType === "comp" ? "Comp" : "Scrim";
  const teamPrefix = resolved?.titlePrefix || "";
  const title = `${teamPrefix}${kindLabel} vs ${scores.opponent}`.slice(0, 120);

  const heloUrl = `${HELO_BASE}/statistics/matches/${encodeURIComponent(matchId)}?series=${encodeURIComponent(series)}`;
  const tournament = String(heloMatch.tournament || "").trim();
  const descParts = [
    `HeLO: ${heloUrl}`,
    `Score: ${heloMatch.result}`,
    tournament ? `Tournament: ${tournament}` : "",
    teamId === "jr" ? "Team: Circle Jr" : "Team: Circle",
  ].filter(Boolean);

  const dateOnly = starts.toISOString().slice(0, 10);
  const participantSteamIds = extractCircleParticipantSteamIds(heloMatch, faction);

  return {
    heloMatchId: matchId,
    warnings,
    event: {
      title,
      eventType,
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      description: descParts.join("\n").slice(0, 1000),
      match: {
        date: dateOnly,
        team: teamId,
        opponent: scores.opponent.slice(0, 80),
        mapId,
        faction,
        result,
        startingPoint: "",
        heloMatchId: matchId,
        heloUrl,
        participantSteamIds,
      },
    },
  };
}
