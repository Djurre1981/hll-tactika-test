import { requireAdmin } from "../lib/auth-request.js";
import { createRosterMember, listRosterMembers, resolveSteamAvatarUrl } from "../lib/roster-store.js";
import { isValidSteamId64 } from "../lib/users-store.js";
import { errorResponse, json } from "../lib/response.js";

const ROSTER_STATUSES = ["active", "inactive", "trial"];
const ROSTER_SITUATIONS = ["member", "merc", "dual_clan"];
const ROSTER_ROLES = [
  "squad_lead",
  "commander",
  "infantry",
  "tanker",
  "artillery",
  "mg",
  // legacy
  "sl",
  "member",
  "reserve",
  "coach",
];

const LEGACY_ROLE_MAP = {
  sl: "squad_lead",
  member: "infantry",
  reserve: "infantry",
  coach: "commander",
};

const T17_ID_LENGTH = 32;

function normalizeRole(role) {
  const raw = String(role || "").trim().toLowerCase();
  if (!raw) return null;
  if (LEGACY_ROLE_MAP[raw]) return LEGACY_ROLE_MAP[raw];
  return ROSTER_ROLES.includes(raw) ? raw : null;
}

function parseRolesInput(value) {
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
    const id = normalizeRole(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    roles.push(id);
  }
  return roles.slice(0, COMP_ROLE_LIMIT);
}

const COMP_ROLE_LIMIT = 6;

function serializeRoles(roles) {
  return roles.length ? JSON.stringify(roles) : null;
}

function parseTournamentsInput(value) {
  if (Array.isArray(value)) {
    return value.map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
      }
    } catch {
      return value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12);
    }
  }
  return [];
}

export function sanitizeRosterBody(body, { partial = false } = {}) {
  const member = {};

  if (!partial || Object.hasOwn(body, "displayName")) {
    const displayName = String(body.displayName || "").trim();
    if (!displayName) return { error: "Display name is required" };
    if (displayName.length > 80) return { error: "Display name is too long" };
    member.displayName = displayName;
  }

  if (Object.hasOwn(body, "steamId") || (!partial && body.steamId !== undefined)) {
    const steamId = String(body.steamId || "").trim();
    if (steamId && !isValidSteamId64(steamId)) {
      return { error: "Invalid Steam ID" };
    }
    member.steamId = steamId || null;
  } else if (!partial) {
    member.steamId = null;
  }

  if (Object.hasOwn(body, "t17Id") || (!partial && body.t17Id !== undefined)) {
    const t17Id = String(body.t17Id || "").trim();
    if (t17Id && t17Id.length !== T17_ID_LENGTH) {
      return { error: `T17 ID must be exactly ${T17_ID_LENGTH} characters` };
    }
    member.t17Id = t17Id || null;
  } else if (!partial) {
    member.t17Id = null;
  }

  if (Object.hasOwn(body, "avatarUrl")) {
    member.avatarUrl = String(body.avatarUrl || "").trim().slice(0, 500) || null;
  } else if (!partial) {
    member.avatarUrl = null;
  }

  if (
    Object.hasOwn(body, "rosterRoles") ||
    Object.hasOwn(body, "rosterRole") ||
    (!partial && (body.rosterRoles !== undefined || body.rosterRole !== undefined))
  ) {
    const fromArray = Object.hasOwn(body, "rosterRoles")
      ? parseRolesInput(body.rosterRoles)
      : [];
    const fromSingle = Object.hasOwn(body, "rosterRole")
      ? parseRolesInput(body.rosterRole)
      : [];
    const roles = fromArray.length > 0 ? fromArray : fromSingle;
    if (
      (Object.hasOwn(body, "rosterRoles") && body.rosterRoles != null && roles.length === 0) ||
      (Object.hasOwn(body, "rosterRole") && body.rosterRole && roles.length === 0)
    ) {
      return { error: "Invalid roster role" };
    }
    member.rosterRole = serializeRoles(roles);
    member.rosterRoles = roles;
  } else if (!partial) {
    member.rosterRole = null;
    member.rosterRoles = [];
  }

  if (Object.hasOwn(body, "tournaments") || (!partial && body.tournaments !== undefined)) {
    member.tournaments = parseTournamentsInput(body.tournaments);
  } else if (!partial) {
    member.tournaments = [];
  }

  if (Object.hasOwn(body, "situation") || (!partial && body.situation !== undefined)) {
    const situation = String(body.situation || "member").trim().toLowerCase();
    if (!ROSTER_SITUATIONS.includes(situation)) {
      return { error: "Invalid situation" };
    }
    member.situation = situation;
  } else if (!partial) {
    member.situation = "member";
  }

  if (Object.hasOwn(body, "status") || !partial) {
    const status = String(body.status || "active").trim().toLowerCase();
    if (!ROSTER_STATUSES.includes(status)) {
      return { error: "Invalid status" };
    }
    member.status = status;
  }

  if (Object.hasOwn(body, "notes")) {
    member.notes = String(body.notes || "").trim().slice(0, 500);
  } else if (!partial) {
    member.notes = "";
  }

  if (Object.hasOwn(body, "sortOrder")) {
    const sortOrder = Number(body.sortOrder);
    member.sortOrder = Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0;
  } else if (!partial) {
    member.sortOrder = 0;
  }

  return { member };
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  try {
    const members = await listRosterMembers(context.env);
    return json({ members });
  } catch (error) {
    console.error("GET /api/roster failed:", error);
    return errorResponse("Failed to load roster", 500);
  }
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const sanitized = sanitizeRosterBody(body || {});
  if (sanitized.error) return errorResponse(sanitized.error, 400);

  const now = new Date().toISOString();
  try {
    const avatarUrl =
      sanitized.member.avatarUrl ||
      (await resolveSteamAvatarUrl(context.env, sanitized.member.steamId, null));
    const member = await createRosterMember(context.env, {
      ...sanitized.member,
      avatarUrl,
      id: `roster-${crypto.randomUUID()}`,
      createdBy: auth.session.steamId,
      createdAt: now,
      updatedAt: now,
    });
    return json({ member }, { status: 201 });
  } catch (error) {
    console.error("POST /api/roster failed:", error);
    return errorResponse("Failed to create roster member", 500);
  }
}
