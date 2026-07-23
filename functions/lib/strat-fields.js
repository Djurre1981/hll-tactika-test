import { sanitizeStratObjects } from "./strat-objects.js";
import { normalizeCompTeamId } from "./comp-teams.js";

export const STRAT_TEAMS = ["jr", "sr"];
export const STRAT_TYPES = ["friendly", "tournament"];
export const STRAT_FACTIONS = ["axis", "allies"];
export const STRAT_RESULTS = ["win", "loss"];
export const MIDPOINT_NA_ID = "na";

export function normalizeStratTeam(value) {
  return STRAT_TEAMS.includes(value) ? value : "jr";
}

/** Calendar/match team: Circle (sr) or Circle Jr (jr). Defaults to senior. */
export function normalizeMatchTeam(value) {
  return normalizeCompTeamId(value, { fallback: "sr" });
}

export function normalizeStratType(value) {
  return STRAT_TYPES.includes(value) ? value : "friendly";
}

export function normalizeStratTitle(value) {
  const title = String(value || "").trim();
  return title || "Untitled Strat";
}

export function normalizeSlideName(value) {
  const name = String(value || "").trim();
  return name || "Untitled";
}

export function normalizeStratFaction(value) {
  return STRAT_FACTIONS.includes(value) ? value : "";
}

export function normalizeStratResult(value) {
  return STRAT_RESULTS.includes(value) ? value : "";
}

export function normalizeMatchDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return "";
  }
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return raw;
}

function normalizeStartingPoint(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (raw === MIDPOINT_NA_ID) {
    return MIDPOINT_NA_ID;
  }
  if (/^\d{2}$/.test(raw)) {
    return raw;
  }
  return "";
}

const HELO_MATCH_ID_MAX = 120;
const HELO_URL_MAX = 500;
const CRCON_URL_MAX = 500;

function normalizeHeloMatchId(value) {
  return String(value || "")
    .trim()
    .slice(0, HELO_MATCH_ID_MAX);
}

function normalizeHeloUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^https:\/\/(?:[\w.-]+\.)?helo-system\.de\//i.test(raw)) {
    return "";
  }
  return raw.slice(0, HELO_URL_MAX);
}

function normalizeCrconUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^https:\/\/stats[14]\.the-circle\.team\/games\/\d+/i.test(raw)) {
    return "";
  }
  return raw.slice(0, CRCON_URL_MAX);
}

function normalizeCrconGameId(value) {
  const raw = String(value || "").trim();
  if (!/^\d+$/.test(raw)) return "";
  return raw.slice(0, 20);
}

const STEAM_ID64_RE = /^7656119\d{10}$/;

/** Normalize a list of Steam ID64 strings (Circle match participants). */
export function normalizeParticipantSteamIds(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    const id = String(raw || "").trim();
    if (!STEAM_ID64_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function emptyStratMatch() {
  return {
    date: "",
    team: "sr",
    faction: "",
    mapId: "",
    startingPoint: "",
    opponent: "",
    result: "",
    heloMatchId: "",
    heloUrl: "",
    crconGameId: "",
    crconUrl: "",
    participantSteamIds: [],
  };
}

export function normalizeStratMatch(match) {
  if (!match || typeof match !== "object") {
    return emptyStratMatch();
  }

  return {
    date: normalizeMatchDate(match.date),
    team: normalizeMatchTeam(match.team),
    faction: normalizeStratFaction(match.faction),
    mapId: String(match.mapId || "").trim(),
    startingPoint: normalizeStartingPoint(match.startingPoint),
    opponent: String(match.opponent || "").trim().slice(0, 80),
    result: normalizeStratResult(match.result),
    heloMatchId: normalizeHeloMatchId(match.heloMatchId),
    heloUrl: normalizeHeloUrl(match.heloUrl),
    crconGameId: normalizeCrconGameId(match.crconGameId),
    crconUrl: normalizeCrconUrl(match.crconUrl),
    participantSteamIds: normalizeParticipantSteamIds(match.participantSteamIds),
  };
}

function normalizeRasterFit(value) {
  const fit = String(value || "").trim();
  return fit === "cover" || fit === "stretch" ? fit : fit === "contain" ? "contain" : undefined;
}

/** undefined = all sectors visible; [] = none; partial list = selected only. */
function normalizeVisibleStrongpoints(value) {
  if (value == null) return undefined;
  if (!Array.isArray(value)) return undefined;
  return [
    ...new Set(value.map(String).filter((key) => /^\d{2}$/.test(key))),
  ];
}

function normalizeSlide(slide, index) {
  if (!slide || typeof slide !== "object") {
    return null;
  }

  const id = String(slide.id || "").trim();
  const mapId = String(slide.mapId || "").trim();
  const rasterUrl = String(slide.rasterUrl || "").trim();
  const rasterFit = normalizeRasterFit(slide.rasterFit);
  if (!id || !mapId) {
    return null;
  }

  return {
    id,
    name: normalizeSlideName(slide.name),
    order: Number.isFinite(Number(slide.order)) ? Number(slide.order) : index,
    mapId,
    objects: sanitizeStratObjects(slide.objects),
    rasterUrl: rasterUrl || undefined,
    rasterFit: rasterUrl ? rasterFit || "contain" : undefined,
    visibleStrongpoints: normalizeVisibleStrongpoints(slide.visibleStrongpoints),
  };
}

export function sanitizeStratInput(strat, { requireSlides = true } = {}) {
  if (!strat || typeof strat !== "object") {
    return { error: "Invalid strat payload" };
  }

  const title = normalizeStratTitle(strat.title);
  const team = normalizeStratTeam(strat.tags?.team);
  const type = normalizeStratType(strat.tags?.type);
  const notes = String(strat.notes || "").trim();
  const match = normalizeStratMatch(strat.match);

  const rawSlides = Array.isArray(strat.slides) ? strat.slides : [];
  const slides = rawSlides
    .map((slide, index) => normalizeSlide(slide, index))
    .filter(Boolean)
    .sort((a, b) => a.order - b.order)
    .map((slide, index) => ({ ...slide, order: index }));

  if (requireSlides && slides.length === 0) {
    return { error: "At least one slide is required" };
  }

  const folderId = String(strat.folderId || "").trim() || null;

  return {
    strat: {
      title,
      tags: { team, type },
      notes,
      match,
      slides,
      folderId,
      locked: Boolean(strat.locked),
      lockedBy: strat.locked ? String(strat.lockedBy || "").trim() || null : null,
    },
  };
}

export function applyStratUpdates(existing, updates) {
  const merged = {
    ...existing,
    ...updates,
    tags: {
      team: normalizeStratTeam(updates.tags?.team ?? existing.tags?.team),
      type: normalizeStratType(updates.tags?.type ?? existing.tags?.type),
    },
  };

  if (updates.title !== undefined) {
    merged.title = normalizeStratTitle(updates.title);
  }
  if (updates.notes !== undefined) {
    merged.notes = String(updates.notes || "").trim();
  }
  if (updates.match !== undefined) {
    merged.match = normalizeStratMatch(updates.match);
  }
  if (Array.isArray(updates.slides)) {
    const sanitized = sanitizeStratInput({ ...merged, slides: updates.slides }, { requireSlides: true });
    if (sanitized.error) {
      return sanitized;
    }
    merged.slides = sanitized.strat.slides;
  }

  if (updates.locked !== undefined) {
    merged.locked = Boolean(updates.locked);
    merged.lockedBy = merged.locked ? String(updates.lockedBy || existing.lockedBy || "").trim() || null : null;
  }

  if (updates.folderId !== undefined) {
    merged.folderId = String(updates.folderId || "").trim() || null;
  }

  return { strat: merged };
}
