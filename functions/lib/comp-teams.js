/**
 * Competitive team identities shared by calendar events and HeLO import.
 * Aligns with strat tags (`jr` / `sr`) but uses display labels Circle / Circle Jr.
 */

export const COMP_TEAM_IDS = ["sr", "jr"];

/** HeLO /v3 `tag` for The Circle - Juniors (U+25EF). */
export const HELO_TEAM_TAG_JR = "\u25EF";
export const HELO_TEAM_TAG_SR = "Circle";

export const COMP_TEAMS = [
  {
    id: "sr",
    label: "Circle",
    shortLabel: "SR",
    heloTag: HELO_TEAM_TAG_SR,
    titlePrefix: "",
  },
  {
    id: "jr",
    label: "Circle Jr",
    shortLabel: "JR",
    heloTag: HELO_TEAM_TAG_JR,
    titlePrefix: "Jr ",
  },
];

const BY_ID = new Map(COMP_TEAMS.map((t) => [t.id, t]));
const BY_HELO = new Map(COMP_TEAMS.map((t) => [t.heloTag, t]));

/** @param {unknown} value */
export function normalizeCompTeamId(value, { fallback = "sr" } = {}) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "sr" || raw === "jr") return raw;
  return COMP_TEAM_IDS.includes(fallback) ? fallback : "sr";
}

/**
 * Resolve CLI / HeLO tag aliases → { id, heloTag, … }.
 * Accepts: Circle, sr, ◯, jr, circle-jr, circle_jr, juniors, …
 * @param {unknown} value
 */
export function resolveCompTeam(value) {
  const raw = String(value || "").trim();
  if (!raw) return BY_ID.get("sr");

  if (BY_ID.has(raw.toLowerCase())) {
    return BY_ID.get(raw.toLowerCase());
  }
  if (BY_HELO.has(raw)) {
    return BY_HELO.get(raw);
  }

  const key = raw.toLowerCase().replace(/\s+/g, "-");
  if (key === "circle" || key === "senior" || key === "the-circle") {
    return BY_ID.get("sr");
  }
  if (
    key === "circle-jr"
    || key === "circle_jr"
    || key === "circlejr"
    || key === "juniors"
    || key === "junior"
    || key === "the-circle-juniors"
  ) {
    return BY_ID.get("jr");
  }

  // Unknown HeLO tag — treat as custom senior-style import, still store as sr if it's Circle
  if (raw === HELO_TEAM_TAG_SR) return BY_ID.get("sr");
  if (raw === HELO_TEAM_TAG_JR) return BY_ID.get("jr");

  return null;
}

export function compTeamLabel(teamId) {
  return BY_ID.get(normalizeCompTeamId(teamId))?.label || "Circle";
}

export function compTeamShortLabel(teamId) {
  return BY_ID.get(normalizeCompTeamId(teamId))?.shortLabel || "SR";
}

export function heloTagForCompTeam(teamId) {
  return BY_ID.get(normalizeCompTeamId(teamId))?.heloTag || HELO_TEAM_TAG_SR;
}

export function compTeamIdForHeloTag(heloTag) {
  return BY_HELO.get(String(heloTag || "").trim())?.id || "sr";
}
