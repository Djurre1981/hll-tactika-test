import { requireAuth } from "../lib/auth-request.js";
import { resolveCreatorName } from "../lib/pin-creators.js";
import { canEnterEditorMode } from "../lib/pin-permissions.js";
import { sanitizeStratInput } from "../lib/strat-fields.js";
import { createStrat, listStrats } from "../lib/strats-store.js";
import { errorResponse, json } from "../lib/response.js";

function buildStratFromBody(strat, createdBy, createdByName) {
  const sanitized = sanitizeStratInput(strat, { requireSlides: true });
  if (sanitized.error) {
    return sanitized;
  }

  const now = new Date().toISOString();
  return {
    strat: {
      ...sanitized.strat,
      id: strat.id || `strat-${crypto.randomUUID()}`,
      createdBy,
      createdByName,
      createdAt: strat.createdAt || now,
      updatedAt: now,
      importSource: strat.importSource || undefined,
    },
  };
}

function stratListItem(strat) {
  return {
    id: strat.id,
    title: strat.title,
    tags: strat.tags,
    notes: strat.notes,
    match: strat.match,
    folderId: strat.folderId || null,
    locked: Boolean(strat.locked),
    lockedBy: strat.lockedBy || null,
    createdBy: strat.createdBy,
    createdByName: strat.createdByName,
    createdAt: strat.createdAt,
    updatedAt: strat.updatedAt,
    slideCount: strat.slideCount ?? (Array.isArray(strat.slides) ? strat.slides.length : 0),
  };
}

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  try {
    const params = new URL(context.request.url).searchParams;
    const folderId = params.get("folderId");
    const lightweight = params.get("meta") === "1";

    const strats = await listStrats(context.env, {
      folderId: folderId || undefined,
      meta: lightweight,
    });

    if (lightweight) {
      return json({ strats: strats.map(stratListItem) });
    }

    return json({ strats });
  } catch (error) {
    console.error("GET /api/strats failed:", error);
    return errorResponse("Strat storage is not configured", 503);
  }
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  if (!canEnterEditorMode(auth.role)) {
    return errorResponse("Editor access required", 403);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const createdByName = await resolveCreatorName(
    auth.session.steamId,
    context.env,
    auth.session
  );

  const built = buildStratFromBody(body.strat || {}, auth.session.steamId, createdByName);
  if (built.error) {
    return errorResponse(built.error, 400);
  }

  try {
    const strat = await createStrat(context.env, built.strat);
    return json({ strat }, { status: 201 });
  } catch (error) {
    console.error("POST /api/strats failed:", error);
    return errorResponse("Strat storage is not configured", 503);
  }
}
