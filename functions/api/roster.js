import { requireAdmin } from "../lib/auth-request.js";
import { createRosterMember, listRosterMembers } from "../lib/roster-store.js";
import { isValidSteamId64 } from "../lib/users-store.js";
import { errorResponse, json } from "../lib/response.js";

const ROSTER_STATUSES = ["active", "inactive", "trial"];
const ROSTER_ROLES = ["commander", "sl", "member", "reserve", "coach"];

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

  if (Object.hasOwn(body, "avatarUrl")) {
    member.avatarUrl = String(body.avatarUrl || "").trim().slice(0, 500) || null;
  } else if (!partial) {
    member.avatarUrl = null;
  }

  if (Object.hasOwn(body, "rosterRole") || (!partial && body.rosterRole !== undefined)) {
    const rosterRole = String(body.rosterRole || "").trim().toLowerCase();
    if (rosterRole && !ROSTER_ROLES.includes(rosterRole)) {
      return { error: "Invalid roster role" };
    }
    member.rosterRole = rosterRole || null;
  } else if (!partial) {
    member.rosterRole = null;
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
    const member = await createRosterMember(context.env, {
      ...sanitized.member,
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
