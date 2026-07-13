import { loadUsersData, saveUsersData } from "./users-store.js";

const PIN_TAG_IDS = ["mg-spot", "climb"];
const FACTIONS = ["axis", "neutral", "allies"];

export const VIEWER_PREFERENCES_DEFAULTS = {
  grid: true,
  strongpoints: true,
  preview: true,
  bgColor: true,
  mapLabels: true,
  bgRandom: true,
  bgHue: null,
  tagFilters: { "mg-spot": true, climb: true },
  faction: "neutral",
};

function normalizeSteamId(steamId) {
  return String(steamId).trim();
}

export function normalizeViewerPreferences(raw) {
  const defaults = VIEWER_PREFERENCES_DEFAULTS;
  if (!raw || typeof raw !== "object") {
    return { ...defaults, tagFilters: { ...defaults.tagFilters } };
  }

  const tagFilters = { ...defaults.tagFilters };
  if (raw.tagFilters && typeof raw.tagFilters === "object") {
    for (const tag of PIN_TAG_IDS) {
      if (typeof raw.tagFilters[tag] === "boolean") {
        tagFilters[tag] = raw.tagFilters[tag];
      }
    }
  }

  let bgHue = null;
  if (typeof raw.bgHue === "number" && Number.isFinite(raw.bgHue)) {
    bgHue = raw.bgHue;
  }

  const bgRandom =
    typeof raw.bgRandom === "boolean" ? raw.bgRandom : bgHue == null;

  const faction = FACTIONS.includes(raw.faction) ? raw.faction : defaults.faction;

  return {
    grid: typeof raw.grid === "boolean" ? raw.grid : defaults.grid,
    strongpoints:
      typeof raw.strongpoints === "boolean" ? raw.strongpoints : defaults.strongpoints,
    preview: typeof raw.preview === "boolean" ? raw.preview : defaults.preview,
    bgColor: typeof raw.bgColor === "boolean" ? raw.bgColor : defaults.bgColor,
    mapLabels: typeof raw.mapLabels === "boolean" ? raw.mapLabels : defaults.mapLabels,
    bgRandom,
    bgHue: bgRandom ? null : bgHue,
    tagFilters,
    faction,
  };
}

export async function getUserPreferences(steamId, env) {
  const id = normalizeSteamId(steamId);
  const data = await loadUsersData(env);
  const member = data.users.find((user) => normalizeSteamId(user.steamId) === id);
  if (!member?.preferences) {
    return null;
  }
  return normalizeViewerPreferences(member.preferences);
}

export async function saveUserPreferences(steamId, env, preferences) {
  const id = normalizeSteamId(steamId);
  const data = await loadUsersData(env);
  const member = data.users.find((user) => normalizeSteamId(user.steamId) === id);
  if (!member) {
    return { error: "User not found" };
  }

  const normalized = normalizeViewerPreferences(preferences);
  member.preferences = normalized;
  await saveUsersData(env, data);
  return { preferences: normalized };
}
