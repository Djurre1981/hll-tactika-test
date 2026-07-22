/** Image map coordinates (0–100), aligned with hq-spawns.json and MapViewer. */
export const MAP_PCT_MIN = 0;
export const MAP_PCT_MAX = 100;
export const METERS_PER_MAP_PCT = 10;

export const ROUTE_COLORS = [
  "#f97316",
  "#38bdf8",
  "#a78bfa",
  "#4ade80",
  "#fb7185",
  "#facc15",
  "#2dd4bf",
  "#c084fc",
];

export const FACTIONS = [
  { id: "us", label: "US" },
  { id: "ger", label: "GER" },
];

/** HQ spawn slots index 0–2 (north → south on typical maps). */
export const HQ_SPAWN_LABELS = ["HQ north", "HQ mid", "HQ south"];

export function getHqSpawnLabel(hqIndex) {
  return HQ_SPAWN_LABELS[hqIndex] ?? `HQ ${hqIndex + 1}`;
}

export function clampPct(value) {
  return Math.min(MAP_PCT_MAX, Math.max(MAP_PCT_MIN, value));
}

/** Per-route faction when set; otherwise plan default. */
export function getRouteFactionId(route, planFactionId = "us") {
  return route?.factionId || planFactionId || "us";
}
