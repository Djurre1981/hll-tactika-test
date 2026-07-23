import { requireAuth } from "../../lib/auth-request.js";
import { canEnterEditorMode } from "../../lib/pin-permissions.js";
import { assertLinkedEventEditable } from "../../lib/event-component-link.js";
import { applyStratUpdates } from "../../lib/strat-fields.js";
import { canDeleteStrat, canModifyStrat } from "../../lib/strat-permissions.js";
import { deleteStrat, getStrat, saveStrat } from "../../lib/strats-store.js";
import {
  assertToolContentEditable,
  canManageToolLock,
  isToolLockOnlyUpdate,
} from "../../lib/tool-lock.js";
import { errorResponse, json } from "../../lib/response.js";

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  const stratId = context.params.stratId;
  try {
    const strat = await getStrat(context.env, stratId);
    if (!strat) {
      return errorResponse("Strat not found", 404);
    }
    return json({ strat });
  } catch (error) {
    console.error("GET /api/strats/:id failed:", error);
    return errorResponse("Strat storage is not configured", 503);
  }
}

export async function onRequestPut(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  if (!canEnterEditorMode(auth.role)) {
    return errorResponse("Editor access required", 403);
  }

  const stratId = context.params.stratId;
  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  try {
    const existing = await getStrat(context.env, stratId);
    if (!existing) {
      return errorResponse("Strat not found", 404);
    }

    if (!canModifyStrat(existing, auth.session.steamId, auth.role)) {
      return errorResponse("Not allowed to edit this strat", 403);
    }

    const updates = body.strat || {};
    if (isToolLockOnlyUpdate(updates) && !canManageToolLock(auth.session.steamId, auth.role, existing.createdBy)) {
      return errorResponse("Not allowed to change lock", 403);
    }

    const editable = assertToolContentEditable(existing, auth.session.steamId, auth.role, updates);
    if (editable.error) {
      return errorResponse(editable.error, editable.status || 423);
    }

    const linked = await assertLinkedEventEditable(context.env, "strat", stratId);
    if (linked.error) {
      return errorResponse(linked.error, linked.status || 423);
    }

    const built = applyStratUpdates(existing, updates);
    if (built.error) {
      return errorResponse(built.error, 400);
    }

    const next = {
      ...built.strat,
      id: existing.id,
      createdBy: existing.createdBy,
      createdByName: existing.createdByName,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      importSource: existing.importSource,
    };

    const strat = await saveStrat(context.env, next);
    return json({ strat });
  } catch (error) {
    console.error("PUT /api/strats/:id failed:", error);
    return errorResponse("Strat storage is not configured", 503);
  }
}

export async function onRequestDelete(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  if (!canEnterEditorMode(auth.role)) {
    return errorResponse("Editor access required", 403);
  }

  const stratId = context.params.stratId;

  try {
    const existing = await getStrat(context.env, stratId);
    if (!existing) {
      return errorResponse("Strat not found", 404);
    }

    if (!canDeleteStrat(existing, auth.session.steamId, auth.role)) {
      return errorResponse("Not allowed to delete this strat", 403);
    }

    const linked = await assertLinkedEventEditable(context.env, "strat", stratId);
    if (linked.error) {
      return errorResponse(linked.error, linked.status || 423);
    }

    await deleteStrat(context.env, stratId);
    return json({ ok: true, stratId });
  } catch (error) {
    console.error("DELETE /api/strats/:id failed:", error);
    return errorResponse("Strat storage is not configured", 503);
  }
}
