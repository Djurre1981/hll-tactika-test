import { requireAuth } from "../../lib/auth-request.js";
import { listMyPrepSlotsInRange } from "../../lib/event-prep-store.js";
import { listIncompletePrepTasksForAssignee } from "../../lib/prep-tasks-store.js";
import { errorResponse, json } from "../../lib/response.js";

/** GET /api/prep-tasks/mine?from=&to= */
export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const url = new URL(context.request.url);
  const from = String(url.searchParams.get("from") || "").trim();
  const to = String(url.searchParams.get("to") || "").trim();

  if (!from || !to) {
    return errorResponse("from and to query params are required", 400);
  }

  try {
    const [legacy, slots] = await Promise.all([
      listIncompletePrepTasksForAssignee(context.env, auth.session.steamId, { from, to }),
      listMyPrepSlotsInRange(context.env, auth.session.steamId, { from, to }),
    ]);
    const tasks = [...slots, ...legacy];
    return json({ tasks });
  } catch (error) {
    console.error("GET /api/prep-tasks/mine failed:", error);
    return errorResponse("Failed to load prep tasks", 500);
  }
}
