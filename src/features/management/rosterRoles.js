/** Shared roster role + tournament chip helpers (management UI). */

export const COMP_ROLES = [
  {
    id: "squad_lead",
    label: "Squad lead",
    icon: "/assets/hll-objects/class-officer.svg",
    color: "#5b8def",
    fade: "linear-gradient(165deg, #3a5f9a 0%, #1a2338 55%, #12151c 100%)",
  },
  {
    id: "commander",
    label: "Commander",
    icon: "/assets/hll-objects/class-commander.svg",
    color: "#c9a227",
    fade: "linear-gradient(165deg, #8a7020 0%, #2a2414 55%, #141210 100%)",
  },
  {
    id: "infantry",
    label: "Infantry",
    icon: "/assets/hll-objects/class-rifleman.svg",
    color: "#6fbf73",
    fade: "linear-gradient(165deg, #3d6b42 0%, #1a241c 55%, #121512 100%)",
  },
  {
    id: "tanker",
    label: "Tanker",
    icon: "/assets/hll-objects/tank-med.svg",
    color: "#9aa3ad",
    fade: "linear-gradient(165deg, #5c646e 0%, #1e2226 55%, #121416 100%)",
  },
  {
    id: "artillery",
    label: "Artillery",
    icon: "/assets/hll-objects/arty.svg",
    color: "#e07a3a",
    fade: "linear-gradient(165deg, #8a4a22 0%, #2a1c14 55%, #141210 100%)",
  },
  {
    id: "mg",
    label: "MG",
    icon: "/assets/hll-objects/class-machine-gunner.svg",
    color: "#d4c4a0",
    fade: "linear-gradient(165deg, #7a6e50 0%, #242018 55%, #141310 100%)",
  },
];

const LEGACY_ROLE_MAP = {
  sl: "squad_lead",
  member: "infantry",
  reserve: "infantry",
  coach: "commander",
};

const TOURNAMENT_PALETTE = [
  { bg: "rgba(91, 141, 239, 0.22)", text: "#9ec0ff", border: "rgba(91, 141, 239, 0.45)" },
  { bg: "rgba(111, 191, 115, 0.22)", text: "#a8e0ab", border: "rgba(111, 191, 115, 0.45)" },
  { bg: "rgba(224, 122, 58, 0.22)", text: "#f0b48a", border: "rgba(224, 122, 58, 0.45)" },
  { bg: "rgba(201, 162, 39, 0.22)", text: "#e8d48a", border: "rgba(201, 162, 39, 0.45)" },
  { bg: "rgba(180, 120, 220, 0.22)", text: "#d4b0f0", border: "rgba(180, 120, 220, 0.45)" },
  { bg: "rgba(80, 200, 200, 0.22)", text: "#9ae0e0", border: "rgba(80, 200, 200, 0.45)" },
];

export function normalizeCompRole(role) {
  const raw = String(role || "").trim().toLowerCase();
  if (!raw) return null;
  if (LEGACY_ROLE_MAP[raw]) return LEGACY_ROLE_MAP[raw];
  return COMP_ROLES.some((r) => r.id === raw) ? raw : null;
}

/** Parse one or many roles from DB/API (string, JSON array, or array). */
export function parseCompRoles(value) {
  let raw = [];
  if (Array.isArray(value)) {
    raw = value;
  } else if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) raw = parsed;
      } catch {
        raw = [trimmed];
      }
    } else if (trimmed.includes(",")) {
      raw = trimmed.split(",");
    } else {
      raw = [trimmed];
    }
  }

  const seen = new Set();
  const roles = [];
  for (const item of raw) {
    const id = normalizeCompRole(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    roles.push(id);
  }
  return roles;
}

export function serializeCompRoles(roles) {
  const list = parseCompRoles(roles);
  return list.length ? JSON.stringify(list) : null;
}

export function getCompRoles(value) {
  const ids = parseCompRoles(value);
  if (ids.length === 0) return [COMP_ROLES[2]];
  return ids.map((id) => COMP_ROLES.find((r) => r.id === id) || COMP_ROLES[2]);
}

export function getCompRole(role) {
  return getCompRoles(role)[0];
}

export function nextCompRole(role) {
  const id = normalizeCompRole(role) || "infantry";
  const index = COMP_ROLES.findIndex((r) => r.id === id);
  return COMP_ROLES[(index + 1) % COMP_ROLES.length].id;
}

export function tournamentColor(name) {
  const str = String(name || "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return TOURNAMENT_PALETTE[hash % TOURNAMENT_PALETTE.length];
}

export function parseTournaments(value) {
  if (Array.isArray(value)) {
    return value.map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((t) => String(t).trim()).filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export const COMP_SITUATIONS = [
  { id: "member", label: "Member" },
  { id: "merc", label: "Merc" },
  { id: "dual_clan", label: "Dual clan" },
];

export function getSituation(value) {
  const id = String(value || "member").trim().toLowerCase();
  return COMP_SITUATIONS.find((s) => s.id === id) || COMP_SITUATIONS[0];
}

export const T17_ID_LENGTH = 32;

export function isValidT17Id(value) {
  const raw = String(value || "").trim();
  return raw.length === 0 || raw.length === T17_ID_LENGTH;
}

export const ROSTER_COLOR_PRESETS = [
  "#5b8def",
  "#e07a3a",
  "#6fbf73",
  "#c9a227",
  "#d44d5c",
  "#9aa3ad",
  "#b478dc",
  "#50c8c8",
];

