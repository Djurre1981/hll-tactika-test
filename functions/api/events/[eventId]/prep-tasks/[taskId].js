import { requireAuth, requireEditor, readJsonBody } from "../../../../lib/auth-request.js";
import {
  canAssigneeCompletePrepTask,
  canEditorManagePrepTasks,
  classifyPrepTaskPatch,
  deletePrepTask,
  getPrepTask,
  sanitizeUpdatePrepTaskBody,
  updatePrepTask,
} from "../../../../lib/prep-tasks-store.js";
import { errorResponse, json } from "../../../../lib/response.js";

function eventIdFromContext(context) {
  return String(context.params?.eventId || "").trim();
}

function taskIdFromContext(context) {
  return String(context.params?.taskId || "").trim();
}

/** PATCH /api/events/:eventId/prep-tasks/:taskId */
export async function onRequestPatch(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const eventId = eventIdFromContext(context);
  const taskId = taskIdFromContext(context);
  if (!eventId || !taskId) return errorResponse("Missing event or task id", 400);

  const parsed = await readJsonBody(context.request);
  if (parsed.error) return parsed.error;

  const sanitized = sanitizeUpdatePrepTaskBody(parsed.body || {});
  if (sanitized.error) return errorResponse(sanitized.error, 400);

  const { patch } = sanitized;
  const { togglesCompletion, editsFields } = classifyPrepTaskPatch(patch);

  try {
    const existing = await getPrepTask(context.env, eventId, taskId);
    if (!existing) return errorResponse("Prep task not found", 404);

    if (editsFields && !canEditorManagePrepTasks(auth.role)) {
      return errorResponse("Editor access required", 403);
    }

    if (togglesCompletion && !canAssigneeCompletePrepTask(existing, auth.session.steamId, auth.role)) {
      return errorResponse("Not allowed to update this task", 403);
    }

    const result = await updatePrepTask(context.env, eventId, taskId, patch);
    if (result.error) return errorResponse(result.error, result.status || 400);
    return json({ task: result.task });
  } catch (error) {
    console.error("PATCH /api/events/:eventId/prep-tasks/:taskId failed:", error);
    return errorResponse("Failed to update prep task", 500);
  }
}

/** DELETE /api/events/:eventId/prep-tasks/:taskId */
export async function onRequestDelete(context) {
  const auth = await requireEditor(context);
  if (auth.error) return auth.error;

  const eventId = eventIdFromContext(context);
  const taskId = taskIdFromContext(context);
  if (!eventId || !taskId) return errorResponse("Missing event or task id", 400);

  try {
    const result = await deletePrepTask(context.env, eventId, taskId);
    if (result.error) return errorResponse(result.error, result.status || 404);
    return json({ ok: true, taskId: result.taskId });
  } catch (error) {
    console.error("DELETE /api/events/:eventId/prep-tasks/:taskId failed:", error);
    return errorResponse("Failed to delete prep task", 500);
  }
}
