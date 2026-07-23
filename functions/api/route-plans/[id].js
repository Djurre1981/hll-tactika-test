import { requireAuth } from "../../lib/auth-request.js";
import { canEnterEditorMode } from "../../lib/pin-permissions.js";
import { assertLinkedEventEditable } from "../../lib/event-component-link.js";
import {
  deleteRoutePlan,
  getRoutePlan,
  saveRoutePlan,
} from "../../lib/route-plans-store.js";
import { errorResponse, json } from "../../lib/response.js";

function canModify(plan, steamId, role) {
  if (role === "owner" || role === "admin" || role === "assist") return true;
  return plan.createdBy === steamId;
}

function canDelete(plan, steamId, role) {
  if (role === "owner" || role === "admin") return true;
  return plan.createdBy === steamId;
}

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const id = context.params.id;
  try {
    const plan = await getRoutePlan(context.env, id);
    if (!plan) return errorResponse("Route plan not found", 404);
    return json({ plan });
  } catch (error) {
    console.error("GET /api/route-plans/:id failed:", error);
    return errorResponse("Route plan storage is not configured", 503);
  }
}

export async function onRequestPut(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  if (!canEnterEditorMode(auth.role)) {
    return errorResponse("Editor access required", 403);
  }

  const id = context.params.id;
  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  try {
    const existing = await getRoutePlan(context.env, id);
    if (!existing) return errorResponse("Route plan not found", 404);

    if (!canModify(existing, auth.session.steamId, auth.role)) {
      return errorResponse("Not allowed to edit this route plan", 403);
    }

    const linked = await assertLinkedEventEditable(context.env, "routePlan", id);
    if (linked.error) {
      return errorResponse(linked.error, linked.status || 423);
    }

    const input = body.plan || body;
    const title =
      typeof input.title === "string" && input.title.trim()
        ? input.title.trim().slice(0, 200)
        : existing.title;
    const plan =
      input.plan && typeof input.plan === "object" ? input.plan : existing.plan;

    const next = {
      ...existing,
      title,
      plan,
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveRoutePlan(context.env, next);
    return json({ plan: saved });
  } catch (error) {
    console.error("PUT /api/route-plans/:id failed:", error);
    return errorResponse("Route plan storage is not configured", 503);
  }
}

export async function onRequestDelete(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  if (!canEnterEditorMode(auth.role)) {
    return errorResponse("Editor access required", 403);
  }

  const id = context.params.id;
  try {
    const existing = await getRoutePlan(context.env, id);
    if (!existing) return errorResponse("Route plan not found", 404);
    if (!canDelete(existing, auth.session.steamId, auth.role)) {
      return errorResponse("Not allowed to delete this route plan", 403);
    }
    const linked = await assertLinkedEventEditable(context.env, "routePlan", id);
    if (linked.error) {
      return errorResponse(linked.error, linked.status || 423);
    }
    await deleteRoutePlan(context.env, id);
    return json({ ok: true, id });
  } catch (error) {
    console.error("DELETE /api/route-plans/:id failed:", error);
    return errorResponse("Route plan storage is not configured", 503);
  }
}
