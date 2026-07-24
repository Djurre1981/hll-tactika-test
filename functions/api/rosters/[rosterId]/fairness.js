import { requireAdmin } from "../../../lib/auth-request.js";
import { getAttendanceStatsForSteamIds } from "../../../lib/lineup-attendance.js";
import { getRoster, listRosterMembersInRoster } from "../../../lib/rosters-store.js";
import { errorResponse, json } from "../../../lib/response.js";

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
    const steamIds = members.map((m) => m.steamId).filter(Boolean);
    const statsBySteamId = await getAttendanceStatsForSteamIds(context.env, steamIds);

    return json({ rosterId, statsBySteamId });
  } catch (error) {
    console.error("GET /api/rosters/:rosterId/fairness failed:", error);
    return errorResponse("Failed to load fairness stats", 500);
  }
}
