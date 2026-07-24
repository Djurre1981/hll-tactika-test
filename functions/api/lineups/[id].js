import { requireAuth, requireAdmin, readJsonBody } from "../../lib/auth-request.js";
import {
  deleteLineup,
  getLineup,
  getLineupFairnessStats,
  lockLineup,
  saveLineupLayout,
  unlockLineup,
} from "../../lib/lineups-store.js";
import { errorResponse, json } from "../../lib/response.js";

function idFromContext(context) {
  return String(context.params?.id || "").trim();
}

/** GET /api/lineups/:id */
export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const id = idFromContext(context);
  if (!id) return errorResponse("Missing lineup id", 400);

  try {
    const lineup = await getLineup(context.env, id);
    if (!lineup) return errorResponse("Lineup not found", 404);
    const fairnessStats = await getLineupFairnessStats(context.env, lineup);
    return json({ lineup, fairnessStats });
  } catch (error) {
    console.error("GET /api/lineups/:id failed:", error);
    return errorResponse("Failed to load lineup", 500);
  }
}

/** PATCH /api/lineups/:id — save layout, lock, or unlock */
export async function onRequestPatch(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const id = idFromContext(context);
  if (!id) return errorResponse("Missing lineup id", 400);

  const parsed = await readJsonBody(context.request);
  if (parsed.error) return parsed.error;
  const body = parsed.body || {};

  try {
    if (body.lock === true) {
      const result = await lockLineup(context.env, id, auth.session.steamId);
      if (result.error) return errorResponse(result.error, result.status || 400);
      const fairnessStats = await getLineupFairnessStats(context.env, result.lineup);
      return json({ lineup: result.lineup, fairnessStats });
    }

    if (body.unlock === true) {
      const result = await unlockLineup(context.env, id);
      if (result.error) return errorResponse(result.error, result.status || 400);
      return json({ lineup: result.lineup });
    }

    if (body.layout !== undefined) {
      const result = await saveLineupLayout(context.env, id, body.layout, {
        actorSteamId: auth.session.steamId,
      });
      if (result.error) return errorResponse(result.error, result.status || 400);
      return json({ lineup: result.lineup });
    }

    return errorResponse("Provide layout, lock, or unlock", 400);
  } catch (error) {
    console.error("PATCH /api/lineups/:id failed:", error);
    return errorResponse("Failed to update lineup", 500);
  }
}

/** DELETE /api/lineups/:id */
export async function onRequestDelete(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const id = idFromContext(context);
  if (!id) return errorResponse("Missing lineup id", 400);

  try {
    const result = await deleteLineup(context.env, id);
    if (result.error) return errorResponse(result.error, result.status || 400);
    return json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/lineups/:id failed:", error);
    return errorResponse("Failed to delete lineup", 500);
  }
}
