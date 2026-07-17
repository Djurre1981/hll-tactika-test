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

const MAP_STORAGE_KEY = "hll-tactika-selected-map";

export function getDefaultMapId() {
  try {
    const stored = localStorage.getItem(MAP_STORAGE_KEY);
    if (stored && STRAT_MAP_IDS.includes(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "Carentan";
}

export function rememberMapId(mapId) {
  if (!mapId) return;
  try {
    localStorage.setItem(MAP_STORAGE_KEY, mapId);
  } catch {
    /* ignore */
  }
}
