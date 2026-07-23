import { requireAdmin, requireAuth } from "../lib/auth-request.js";
import {
  aggregateCombatBySteamId,
  listPlayerMatchStatsForEvent,
  listPlayerMatchStatsForSteamIds,
} from "../lib/player-match-stats-store.js";
import { errorResponse, json } from "../lib/response.js";

/**
 * GET /api/player-stats?eventId=…
 * GET /api/player-stats?steamIds=id1,id2
 * Staff aggregates for Management Overview form board.
 */
export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const url = new URL(context.request.url);
  const eventId = String(url.searchParams.get("eventId") || "").trim();
  const steamIdsRaw = String(url.searchParams.get("steamIds") || "").trim();

  try {
    if (eventId) {
      const stats = await listPlayerMatchStatsForEvent(context.env, eventId);
      return json({ stats });
    }

    if (steamIdsRaw) {
      const admin = await requireAdmin(context);
      if (admin.error) return admin.error;

      const steamIds = steamIdsRaw.split(",").map((id) => id.trim()).filter(Boolean);
      const stats = await listPlayerMatchStatsForSteamIds(context.env, steamIds);
      return json({
        stats,
        aggregates: aggregateCombatBySteamId(stats),
      });
    }

    return errorResponse("eventId or steamIds query param required", 400);
  } catch (error) {
    console.error("GET /api/player-stats failed:", error);
    return errorResponse("Failed to load player stats", 500);
  }
}
