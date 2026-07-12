import { requireAuth } from "../../../../lib/auth-request.js";
import { canEnterEditorMode } from "../../../../lib/pin-permissions.js";
import { normalizeSlideName } from "../../../../lib/strat-fields.js";
import { canModifyStrat } from "../../../../lib/strat-permissions.js";
import { findStrat, loadStratsData, saveStratsData } from "../../../../lib/strats-store.js";
import { errorResponse, json } from "../../../../lib/response.js";

function cloneSlide(slide, order, name) {
  return {
    ...structuredClone(slide),
    id: `slide-${crypto.randomUUID()}`,
    name: normalizeSlideName(name || `${slide.name} (copy)`),
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

  const { stratId, slideId } = context.params;
  let body = {};
  try {
    body = await context.request.json();
  } catch {
    body = {};
  }

  const data = await loadStratsData(context.env);
  const sourceFound = findStrat(data, stratId);
  if (!sourceFound) {
    return errorResponse("Strat not found", 404);
  }

  const slideIndex = (sourceFound.strat.slides || []).findIndex((slide) => slide.id === slideId);
  if (slideIndex < 0) {
    return errorResponse("Slide not found", 404);
  }

  const targetStratId = String(body.targetStratId || stratId).trim();
  const targetFound = findStrat(data, targetStratId);
  if (!targetFound) {
    return errorResponse("Target strat not found", 404);
  }

  if (
    !canModifyStrat(sourceFound.strat, auth.session.steamId, auth.role)
    || !canModifyStrat(targetFound.strat, auth.session.steamId, auth.role)
  ) {
    return errorResponse("Not allowed to duplicate this slide", 403);
  }

  const sourceSlide = sourceFound.strat.slides[slideIndex];
  const order = targetFound.strat.slides.length;
  const duplicate = cloneSlide(sourceSlide, order, body.name);

  targetFound.strat.slides.push(duplicate);
  targetFound.strat.updatedAt = new Date().toISOString();

  try {
    await saveStratsData(context.env, data);
  } catch (error) {
    console.error(error);
    return errorResponse("Strat storage is not configured", 503);
  }

  return json({
    slide: duplicate,
    stratId: targetStratId,
  }, { status: 201 });
}
