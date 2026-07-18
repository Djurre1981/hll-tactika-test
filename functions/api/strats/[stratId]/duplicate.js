import { requireAuth } from "../../../lib/auth-request.js";
import { resolveCreatorName } from "../../../lib/pin-creators.js";
import { canEnterEditorMode } from "../../../lib/pin-permissions.js";
import { normalizeStratTitle } from "../../../lib/strat-fields.js";
import { canModifyStrat } from "../../../lib/strat-permissions.js";
import { createStrat, getStrat } from "../../../lib/strats-store.js";
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

  try {
    const source = await getStrat(context.env, stratId);
    if (!source) {
      return errorResponse("Strat not found", 404);
    }

    if (!canModifyStrat(source, auth.session.steamId, auth.role)) {
      return errorResponse("Not allowed to duplicate this strat", 403);
    }

    const createdByName = await resolveCreatorName(
      auth.session.steamId,
      context.env,
      auth.session
    );

    const now = new Date().toISOString();
    const duplicate = {
      ...structuredClone(source),
      id: `strat-${crypto.randomUUID()}`,
      title: normalizeStratTitle(body.title || `${source.title} (copy)`),
      slides: (source.slides || []).map((slide, index) => cloneSlide(slide, index)),
      createdBy: auth.session.steamId,
      createdByName,
      createdAt: now,
      updatedAt: now,
      locked: false,
      lockedBy: null,
    };

    const strat = await createStrat(context.env, duplicate);
    return json({ strat }, { status: 201 });
  } catch (error) {
    console.error("POST /api/strats/:id/duplicate failed:", error);
    return errorResponse("Strat storage is not configured", 503);
  }
}
