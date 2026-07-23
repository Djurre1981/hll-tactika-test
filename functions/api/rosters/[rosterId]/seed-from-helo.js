import { requireAdmin } from "../../../lib/auth-request.js";
import { seedRosterFromMatchParticipants } from "../../../lib/rosters-store.js";
import { errorResponse, json } from "../../../lib/response.js";

function rosterIdFromContext(context) {
  return String(context.params?.rosterId || "").trim();
}

/**
 * POST /api/rosters/:rosterId/seed-from-helo
 * Create/link roster members from Circle HeLO participantSteamIds on events.
 * Does not grant site access.
 */
export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const rosterId = rosterIdFromContext(context);
  if (!rosterId) return errorResponse("Missing roster id", 400);

  try {
    const result = await seedRosterFromMatchParticipants(
      context.env,
      rosterId,
      auth.session.steamId
    );
    if (result.error) return errorResponse(result.error, result.status || 400);
    return json({
      rosterId,
      ...result,
      note: "Seeded from match participants only — site access unchanged",
    });
  } catch (error) {
    console.error("POST /api/rosters/:rosterId/seed-from-helo failed:", error);
    return errorResponse("Failed to seed roster from HeLO participants", 500);
  }
}
