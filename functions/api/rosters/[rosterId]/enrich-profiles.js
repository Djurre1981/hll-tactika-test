import { requireAdmin } from "../../../lib/auth-request.js";
import { enrichRosterMemberProfiles } from "../../../lib/rosters-store.js";
import { errorResponse, json } from "../../../lib/response.js";

function rosterIdFromContext(context) {
  return String(context.params?.rosterId || "").trim();
}

/**
 * POST /api/rosters/:rosterId/enrich-profiles
 * Resolve Steam persona names/avatars for seeded "Player ####" placeholders.
 */
export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const rosterId = rosterIdFromContext(context);
  if (!rosterId) return errorResponse("Missing roster id", 400);

  try {
    const result = await enrichRosterMemberProfiles(context.env, rosterId, { limit: 20 });
    if (result.error) return errorResponse(result.error, result.status || 400);
    return json({
      rosterId,
      ...result,
      note: "Re-run while remaining > 0 to finish name/avatar resolution.",
    });
  } catch (error) {
    console.error("POST /api/rosters/:rosterId/enrich-profiles failed:", error);
    return errorResponse(error?.message || "Failed to enrich roster profiles", 500);
  }
}
