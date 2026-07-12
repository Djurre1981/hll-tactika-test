import { requireAuth } from "../../../lib/auth-request.js";
import { resolveCreatorName } from "../../../lib/pin-creators.js";
import { canEnterEditorMode } from "../../../lib/pin-permissions.js";
import { normalizeStratTitle } from "../../../lib/strat-fields.js";
import { canModifyStrat } from "../../../lib/strat-permissions.js";
import { findStrat, loadStratsData, saveStratsData } from "../../../lib/strats-store.js";
import { errorResponse, json } from "../../../lib/response.js";

function cloneSlide(slide, order) {
  return {
    ...structuredClone(slide),
    id: `slide-${crypto.randomUUID()}`,
    order,
    objects: structuredClone(slide.objects || []),
  };
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  if (!canEnterEditorMode(auth.role)) {
    return errorResponse("Editor access required", 403);
  }

  const stratId = context.params.stratId;
  let body = {};
  try {
    body = await context.request.json();
  } catch {
    body = {};
  }

  const data = await loadStratsData(context.env);
  const found = findStrat(data, stratId);
  if (!found) {
    return errorResponse("Strat not found", 404);
  }

  if (!canModifyStrat(found.strat, auth.session.steamId, auth.role)) {
    return errorResponse("Not allowed to duplicate this strat", 403);
  }

  const createdByName = await resolveCreatorName(
    auth.session.steamId,
    context.env,
    auth.session
  );

  const now = new Date().toISOString();
  const duplicate = {
    ...structuredClone(found.strat),
    id: `strat-${crypto.randomUUID()}`,
    title: normalizeStratTitle(body.title || `${found.strat.title} (copy)`),
    slides: (found.strat.slides || []).map((slide, index) => cloneSlide(slide, index)),
    createdBy: auth.session.steamId,
    createdByName,
    createdAt: now,
    updatedAt: now,
    locked: false,
    lockedBy: null,
  };

  data.strats.push(duplicate);

  try {
    await saveStratsData(context.env, data);
  } catch (error) {
    console.error(error);
    return errorResponse("Strat storage is not configured", 503);
  }

  return json({ strat: duplicate }, { status: 201 });
}
