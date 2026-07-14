import { getCurrentUser, setCurrentUser } from "./api/auth.js";
import { patchViewerPreferences as patchViewerPreferencesApi } from "./api/preferences.js";

export const DEFAULT_VIEWER_PREFERENCES = {
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

const PIN_TAG_IDS = ["mg-spot", "climb"];
const FACTIONS = ["axis", "neutral", "allies"];

let resolvedPrefs = cloneDefaults();
let saveTimer = null;

function cloneDefaults() {
  return {
    ...DEFAULT_VIEWER_PREFERENCES,
    tagFilters: { ...DEFAULT_VIEWER_PREFERENCES.tagFilters },
  };
}

function normalizeViewerPreferences(raw) {
  const defaults = DEFAULT_VIEWER_PREFERENCES;
  if (!raw || typeof raw !== "object") {
    return cloneDefaults();
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

function mergePreferences(partial) {
  const next = {
    ...resolvedPrefs,
    ...partial,
    tagFilters: {
      ...resolvedPrefs.tagFilters,
      ...(partial.tagFilters || {}),
    },
  };

  if (partial.bgRandom === true) {
    next.bgHue = null;
  }
  if (typeof partial.bgHue === "number") {
    next.bgRandom = false;
    next.bgHue = partial.bgHue;
  }

  resolvedPrefs = normalizeViewerPreferences(next);
  return resolvedPrefs;
}

async function persistViewerPreferences(prefs) {
  const data = await patchViewerPreferencesApi(prefs);
  if (data.preferences) {
    resolvedPrefs = normalizeViewerPreferences(data.preferences);
    const user = getCurrentUser();
    if (user) {
      setCurrentUser({ ...user, preferences: resolvedPrefs });
    }
  }
}

export function initViewerPreferences(user) {
  if (user?.preferences && typeof user.preferences === "object") {
    resolvedPrefs = normalizeViewerPreferences(user.preferences);
    return;
  }
  resolvedPrefs = cloneDefaults();
}

export function getViewerPreferences() {
  return resolvedPrefs;
}

export function scheduleSaveViewerPreferences(partial) {
  const prefs = mergePreferences(partial);
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistViewerPreferences(prefs).catch((error) => {
      console.error(error);
    });
  }, 300);
}
