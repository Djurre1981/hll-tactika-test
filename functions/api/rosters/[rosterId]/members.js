import { requireAdmin } from "../../../lib/auth-request.js";
import {
  addMemberToRoster,
  ensureMemberAndAddToRoster,
  getRoster,
  listRosterMembersInRoster,
} from "../../../lib/rosters-store.js";
import { errorResponse, json } from "../../../lib/response.js";
import { sanitizeRosterBody } from "../../roster.js";

function rosterIdFromContext(context) {
  return String(context.params?.rosterId || "").trim();
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const rosterId = rosterIdFromContext(context);
  if (!rosterId) return errorResponse("Missing roster id", 400);

  try {
    const roster = await getRoster(context.env, rosterId);
    if (!roster) return errorResponse("Roster not found", 404);
    const members = await listRosterMembersInRoster(context.env, rosterId);
    return json({ roster, members });
  } catch (error) {
    console.error("GET /api/rosters/:rosterId/members failed:", error);
    return errorResponse("Failed to load roster members", 500);
  }
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const rosterId = rosterIdFromContext(context);
  if (!rosterId) return errorResponse("Missing roster id", 400);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const roster = await getRoster(context.env, rosterId);
  if (!roster) return errorResponse("Roster not found", 404);

  if (body?.memberId) {
    const result = await addMemberToRoster(context.env, rosterId, String(body.memberId).trim(), {
      rosterRole: body.rosterRole || null,
    });
    if (result.error) return errorResponse(result.error, result.status || 400);
    return json({ member: result.member, alreadyMember: Boolean(result.alreadyMember) }, { status: 201 });
  }

  const sanitized = sanitizeRosterBody(body || {});
  if (sanitized.error) return errorResponse(sanitized.error, 400);
  if (!sanitized.member.steamId) return errorResponse("Steam ID is required", 400);

  const now = new Date().toISOString();
  try {
    const result = await ensureMemberAndAddToRoster(context.env, rosterId, {
      ...sanitized.member,
      id: `roster-${crypto.randomUUID()}`,
      createdBy: auth.session.steamId,
      createdAt: now,
      updatedAt: now,
    });
    if (result.error) return errorResponse(result.error, result.status || 400);
    return json(
      { member: result.member, alreadyMember: Boolean(result.alreadyMember) },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/rosters/:rosterId/members failed:", error);
    return errorResponse("Failed to add roster member", 500);
  }
}
