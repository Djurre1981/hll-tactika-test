/** Fixed event preparation task types (shared by API + UI). */

export const PREP_STRAT_CATEGORIES = ["general", "tank", "defense", "mg"];

export const PREP_TASK_TYPES = [
  { id: "general_strat", label: "General strat", link: "strat", prepCategory: "general" },
  { id: "tank_strat", label: "Tank strat", link: "strat", prepCategory: "tank" },
  { id: "defense_strat", label: "Defense strat", link: "strat", prepCategory: "defense" },
  { id: "mg_strat", label: "MG strat", link: "strat", prepCategory: "mg" },
  { id: "routes", label: "Routes", link: "routes" },
  { id: "snipes", label: "Snipes", link: "manual" },
  { id: "commander_prep", label: "Commander prep", link: "manual" },
  { id: "lineups", label: "LineUps", link: "lineups" },
  { id: "other", label: "Other", link: "manual" },
];

export const PREP_TASK_TYPE_IDS = PREP_TASK_TYPES.map((row) => row.id);

const TYPE_BY_ID = new Map(PREP_TASK_TYPES.map((row) => [row.id, row]));

export function prepTaskMeta(taskType) {
  return TYPE_BY_ID.get(String(taskType || "").trim()) || null;
}

export function defaultEnabledPrepTypes(eventType) {
  const type = String(eventType || "other").trim().toLowerCase();
  if (type === "comp") return [...PREP_TASK_TYPE_IDS];
  if (type === "scrim") return ["general_strat", "tank_strat", "routes", "lineups"];
  return ["general_strat"];
}

export function normalizePrepCategory(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;
  return PREP_STRAT_CATEGORIES.includes(value) ? value : null;
}
