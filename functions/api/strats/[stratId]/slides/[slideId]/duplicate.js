import { requireAuth } from "../../../../../lib/auth-request.js";
import { canEnterEditorMode } from "../../../../../lib/pin-permissions.js";
import { normalizeSlideName } from "../../../../../lib/strat-fields.js";
import { canModifyStrat } from "../../../../../lib/strat-permissions.js";
import { getStrat, saveStrat } from "../../../../../lib/strats-store.js";
import { errorResponse, json } from "../../../../../lib/response.js";

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

  try {
    const source = await getStrat(context.env, stratId);
    if (!source) {
      return errorResponse("Strat not found", 404);
    }

    const slideIndex = (source.slides || []).findIndex((slide) => slide.id === slideId);
    if (slideIndex < 0) {
      return errorResponse("Slide not found", 404);
    }

    const targetStratId = String(body.targetStratId || stratId).trim();
    const target =
      targetStratId === stratId ? source : await getStrat(context.env, targetStratId);
    if (!target) {
      return errorResponse("Target strat not found", 404);
    }

    if (
      !canModifyStrat(source, auth.session.steamId, auth.role) ||
      !canModifyStrat(target, auth.session.steamId, auth.role)
    ) {
      return errorResponse("Not allowed to duplicate this slide", 403);
    }

    const sourceSlide = source.slides[slideIndex];
    const order = target.slides.length;
    const duplicate = cloneSlide(sourceSlide, order, body.name);

    target.slides.push(duplicate);
    target.updatedAt = new Date().toISOString();
    await saveStrat(context.env, target);

    return json(
      {
        slide: duplicate,
        stratId: targetStratId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST slide duplicate failed:", error);
    return errorResponse("Strat storage is not configured", 503);
  }
}
