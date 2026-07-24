import { requireAuth, requireEditor, readJsonBody } from "../../../lib/auth-request.js";
import {
  getEventPrepPlan,
  saveEventPrepPlan,
  setPrepSlotDone,
} from "../../../lib/event-prep-store.js";
import { errorResponse, json } from "../../../lib/response.js";

function eventIdFromContext(context) {
  return String(context.params?.eventId || "").trim();
}

/** GET /api/events/:eventId/prep-plan */
export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const eventId = eventIdFromContext(context);
  if (!eventId) return errorResponse("Missing event id", 400);

  try {
    const plan = await getEventPrepPlan(context.env, eventId);
    if (plan.error) return errorResponse(plan.error, plan.status || 404);
    return json(plan);
  } catch (error) {
    console.error("GET /api/events/:eventId/prep-plan failed:", error);
    return errorResponse("Failed to load prep plan", 500);
  }
}

/** PUT /api/events/:eventId/prep-plan */
export async function onRequestPut(context) {
  const auth = await requireEditor(context);
  if (auth.error) return auth.error;

  const eventId = eventIdFromContext(context);
  if (!eventId) return errorResponse("Missing event id", 400);

  const parsed = await readJsonBody(context.request);
  if (parsed.error) return parsed.error;

  try {
    const plan = await saveEventPrepPlan(context.env, eventId, parsed.body?.slots || [], {
      actorRole: auth.role,
    });
    if (plan.error) return errorResponse(plan.error, plan.status || 400);
    return json(plan);
  } catch (error) {
    console.error("PUT /api/events/:eventId/prep-plan failed:", error);
    return errorResponse("Failed to save prep plan", 500);
  }
}

/** PATCH /api/events/:eventId/prep-plan — mark slot done { taskType, done } */
export async function onRequestPatch(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const eventId = eventIdFromContext(context);
  if (!eventId) return errorResponse("Missing event id", 400);

  const parsed = await readJsonBody(context.request);
  if (parsed.error) return parsed.error;

  const taskType = String(parsed.body?.taskType || "").trim();
  if (!taskType) return errorResponse("taskType is required", 400);

  try {
    const plan = await setPrepSlotDone(context.env, eventId, taskType, Boolean(parsed.body?.done), {
      steamId: auth.session.steamId,
      role: auth.role,
    });
    if (plan.error) return errorResponse(plan.error, plan.status || 400);
    return json(plan);
  } catch (error) {
    console.error("PATCH /api/events/:eventId/prep-plan failed:", error);
    return errorResponse("Failed to update prep slot", 500);
  }
}
