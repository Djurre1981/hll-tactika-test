import { requireAdmin } from "../../lib/auth-request.js";
import { deleteRoster, getRoster, updateRoster } from "../../lib/rosters-store.js";
import { errorResponse, json } from "../../lib/response.js";
import { sanitizeRosterMetaBody } from "../rosters.js";

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
    return json({ roster });
  } catch (error) {
    console.error("GET /api/rosters/:rosterId failed:", error);
    return errorResponse("Failed to load roster", 500);
  }
}

export async function onRequestPatch(context) {
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

  const sanitized = sanitizeRosterMetaBody(body || {}, { partial: true });
  if (sanitized.error) return errorResponse(sanitized.error, 400);

  try {
    const roster = await updateRoster(context.env, rosterId, sanitized.roster);
    if (!roster) return errorResponse("Roster not found", 404);
    return json({ roster });
  } catch (error) {
    console.error("PATCH /api/rosters/:rosterId failed:", error);
    return errorResponse("Failed to update roster", 500);
  }
}

export async function onRequestDelete(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const rosterId = rosterIdFromContext(context);
  if (!rosterId) return errorResponse("Missing roster id", 400);

  try {
    const roster = await deleteRoster(context.env, rosterId);
    if (!roster) return errorResponse("Roster not found", 404);
    return json({ ok: true, rosterId });
  } catch (error) {
    console.error("DELETE /api/rosters/:rosterId failed:", error);
    return errorResponse("Failed to delete roster", 500);
  }
}
