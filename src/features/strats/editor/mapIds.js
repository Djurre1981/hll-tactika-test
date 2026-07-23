/** Hell Let Loose map ids used by strat slides. */
export const STRAT_MAP_IDS = [
  "Carentan",
  "Driel",
  "ElAlamein",
  "Elsenborn",
  "Foy",
  "Hill400",
  "HurtgenV2",
  "Juno",
  "Kharkov",
  "Kursk",
  "Mortain",
  "Omaha",
  "PHL",
  "Remagen",
  "SMDMV2",
  "SME",
  "Smolensk",
  "Stalingrad",
  "Tobruk",
  "Utah",
];

/** Normalize known bad / HeLO-variant map ids to canonical STRAT_MAP_IDS. */
export const MAP_ID_ALIASES = {
  SHD65V2: "SMDMV2",
  SMDM: "SMDMV2",
  Hurtgen: "HurtgenV2",
};

/** Human-readable labels for chart axes and summaries. */
export const MAP_LABELS = {
  Carentan: "Carentan",
  Driel: "Driel",
  ElAlamein: "El Alamein",
  Elsenborn: "Elsenborn",
  Foy: "Foy",
  Hill400: "Hill 400",
  HurtgenV2: "Hurtgen",
  Juno: "Juno",
  Kharkov: "Kharkov",
  Kursk: "Kursk",
  Mortain: "Mortain",
  Omaha: "Omaha",
  PHL: "PHL",
  Remagen: "Remagen",
  SMDMV2: "Saint Marie du Mont",
  SME: "Sainte-Mère-Église",
  Smolensk: "Smolensk",
  Stalingrad: "Stalingrad",
  Tobruk: "Tobruk",
  Utah: "Utah",
};

export function normalizeMapId(mapId) {
  const raw = String(mapId || "").trim();
  if (!raw) return "";
  if (Object.hasOwn(MAP_ID_ALIASES, raw)) return MAP_ID_ALIASES[raw];
  return raw;
}

export function formatMapLabel(mapId) {
  const id = normalizeMapId(mapId);
  if (!id) return "Unknown map";
  return MAP_LABELS[id] || id;
}

const MAP_STORAGE_KEY = "hll-tactika-selected-map";

export function getDefaultMapId() {
  try {
    const stored = localStorage.getItem(MAP_STORAGE_KEY);
    if (stored && STRAT_MAP_IDS.includes(stored)) return stored;
    const aliased = normalizeMapId(stored);
    if (aliased && STRAT_MAP_IDS.includes(aliased)) return aliased;
  } catch {
    /* ignore */
  }
  return "Carentan";
}

export function rememberMapId(mapId) {
  if (!mapId) return;
  try {
    localStorage.setItem(MAP_STORAGE_KEY, normalizeMapId(mapId) || mapId);
  } catch {
    /* ignore */
  }
}
