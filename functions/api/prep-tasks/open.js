import { requireAdmin } from "../../lib/auth-request.js";
import { listOpenPrepSlotsInRange } from "../../lib/event-prep-store.js";
import { listOpenPrepTasksInRange } from "../../lib/prep-tasks-store.js";
import { errorResponse, json } from "../../lib/response.js";

/** GET /api/prep-tasks/open?from=&to= — staff: all incomplete tasks in range */
export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const url = new URL(context.request.url);
  const from = String(url.searchParams.get("from") || "").trim();
  const to = String(url.searchParams.get("to") || "").trim();

  if (!from || !to) {
    return errorResponse("from and to query params are required", 400);
  }

  try {
    const [legacy, slots] = await Promise.all([
      listOpenPrepTasksInRange(context.env, { from, to }),
      listOpenPrepSlotsInRange(context.env, { from, to }),
    ]);
    const tasks = [...slots, ...legacy];
    return json({ tasks });
  } catch (error) {
    console.error("GET /api/prep-tasks/open failed:", error);
    return errorResponse("Failed to load open prep tasks", 500);
  }
}
