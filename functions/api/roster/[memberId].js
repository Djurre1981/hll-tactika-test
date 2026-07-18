import { requireAdmin } from "../../lib/auth-request.js";
import {
  deleteRosterMember,
  updateRosterMember,
} from "../../lib/roster-store.js";
import { errorResponse, json } from "../../lib/response.js";
import { sanitizeRosterBody } from "../roster.js";

function memberIdFromContext(context) {
  return String(context.params?.memberId || "").trim();
}

async function requireRosterAdmin(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth;
  return auth;
}

export async function onRequestPatch(context) {
  const auth = await requireRosterAdmin(context);
  if (auth.error) return auth.error;

  const memberId = memberIdFromContext(context);
  if (!memberId) return errorResponse("Missing member id", 400);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const sanitized = sanitizeRosterBody(body || {}, { partial: true });
  if (sanitized.error) return errorResponse(sanitized.error, 400);

  try {
    const member = await updateRosterMember(context.env, memberId, sanitized.member);
    if (!member) return errorResponse("Member not found", 404);
    return json({ member });
  } catch (error) {
    console.error("PATCH /api/roster/:memberId failed:", error);
    return errorResponse("Failed to update roster member", 500);
  }
}

export async function onRequestDelete(context) {
  const auth = await requireRosterAdmin(context);
  if (auth.error) return auth.error;

  const memberId = memberIdFromContext(context);
  if (!memberId) return errorResponse("Missing member id", 400);

  try {
    const member = await deleteRosterMember(context.env, memberId);
    if (!member) return errorResponse("Member not found", 404);
    return json({ ok: true, memberId });
  } catch (error) {
    console.error("DELETE /api/roster/:memberId failed:", error);
    return errorResponse("Failed to delete roster member", 500);
  }
}
