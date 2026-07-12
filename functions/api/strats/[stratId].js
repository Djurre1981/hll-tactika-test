import { requireAuth } from "../../lib/auth-request.js";
import { canEnterEditorMode } from "../../lib/pin-permissions.js";
import { applyStratUpdates } from "../../lib/strat-fields.js";
import { canDeleteStrat, canModifyStrat } from "../../lib/strat-permissions.js";
import { findStrat, loadStratsData, saveStratsData } from "../../lib/strats-store.js";
import { errorResponse, json } from "../../lib/response.js";

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

  const data = await loadStratsData(context.env);
  const found = findStrat(data, stratId);
  if (!found) {
    return errorResponse("Strat not found", 404);
  }

  if (!canModifyStrat(found.strat, auth.session.steamId, auth.role)) {
    return errorResponse("Not allowed to edit this strat", 403);
  }

  if (found.strat.locked && found.strat.createdBy !== auth.session.steamId && auth.role !== "owner") {
    return errorResponse("Strat is locked", 423);
  }

  const built = applyStratUpdates(found.strat, body.strat || {});
  if (built.error) {
    return errorResponse(built.error, 400);
  }

  found.strats[found.index] = {
    ...built.strat,
    id: found.strat.id,
    createdBy: found.strat.createdBy,
    createdByName: found.strat.createdByName,
    createdAt: found.strat.createdAt,
    updatedAt: new Date().toISOString(),
  };

  try {
    await saveStratsData(context.env, data);
  } catch (error) {
    console.error(error);
    return errorResponse("Strat storage is not configured", 503);
  }

  return json({ strat: found.strats[found.index] });
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
  const data = await loadStratsData(context.env);
  const found = findStrat(data, stratId);
  if (!found) {
    return errorResponse("Strat not found", 404);
  }

  if (!canDeleteStrat(found.strat, auth.session.steamId, auth.role)) {
    return errorResponse("Not allowed to delete this strat", 403);
  }

  found.strats.splice(found.index, 1);

  try {
    await saveStratsData(context.env, data);
  } catch (error) {
    console.error(error);
    return errorResponse("Strat storage is not configured", 503);
  }

  return json({ ok: true, stratId });
}
