import { requireAdmin } from "../../../../../lib/auth-request.js";
import { getRoster, removeMemberFromRoster } from "../../../../../lib/rosters-store.js";
import { errorResponse, json } from "../../../../../lib/response.js";

export async function onRequestDelete(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const rosterId = String(context.params?.rosterId || "").trim();
  const memberId = String(context.params?.memberId || "").trim();
  if (!rosterId || !memberId) return errorResponse("Missing roster or member id", 400);

  try {
    const roster = await getRoster(context.env, rosterId);
    if (!roster) return errorResponse("Roster not found", 404);

    const removed = await removeMemberFromRoster(context.env, rosterId, memberId);
    if (!removed) return errorResponse("Member not in this roster", 404);
    return json({ ok: true, rosterId, memberId });
  } catch (error) {
    console.error("DELETE /api/rosters/:rosterId/members/:memberId failed:", error);
    return errorResponse("Failed to remove member from roster", 500);
  }
}
