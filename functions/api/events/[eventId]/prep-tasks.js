import { requireAuth, requireEditor, readJsonBody } from "../../../lib/auth-request.js";
import {
  createPrepTask,
  listPrepTasksForEvent,
  sanitizeCreatePrepTaskBody,
} from "../../../lib/prep-tasks-store.js";
import { errorResponse, json } from "../../../lib/response.js";

function eventIdFromContext(context) {
  return String(context.params?.eventId || "").trim();
}

/** GET /api/events/:eventId/prep-tasks */
export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const eventId = eventIdFromContext(context);
  if (!eventId) return errorResponse("Missing event id", 400);

  try {
    const tasks = await listPrepTasksForEvent(context.env, eventId);
    return json({ tasks });
  } catch (error) {
    console.error("GET /api/events/:eventId/prep-tasks failed:", error);
    return errorResponse("Failed to load prep tasks", 500);
  }
}

/** POST /api/events/:eventId/prep-tasks */
export async function onRequestPost(context) {
  const auth = await requireEditor(context);
  if (auth.error) return auth.error;

  const eventId = eventIdFromContext(context);
  if (!eventId) return errorResponse("Missing event id", 400);

  const parsed = await readJsonBody(context.request);
  if (parsed.error) return parsed.error;

  const sanitized = sanitizeCreatePrepTaskBody(parsed.body || {});
  if (sanitized.error) return errorResponse(sanitized.error, 400);

  try {
    const result = await createPrepTask(
      context.env,
      eventId,
      sanitized.task,
      auth.session.steamId
    );
    if (result.error) return errorResponse(result.error, result.status || 400);
    return json({ task: result.task }, { status: 201 });
  } catch (error) {
    console.error("POST /api/events/:eventId/prep-tasks failed:", error);
    return errorResponse("Failed to create prep task", 500);
  }
}
