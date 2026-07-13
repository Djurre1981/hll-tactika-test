import { requireAuth } from "../lib/auth-request.js";
import { resolveCreatorName } from "../lib/pin-creators.js";
import { canEnterEditorMode } from "../lib/pin-permissions.js";
import { sanitizeStratInput } from "../lib/strat-fields.js";
import { loadStratsData, saveStratsData } from "../lib/strats-store.js";
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

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  const data = await loadStratsData(context.env);
  return json(data);
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

  const data = await loadStratsData(context.env);
  data.strats.push(built.strat);

  try {
    await saveStratsData(context.env, data);
  } catch (error) {
    console.error(error);
    return errorResponse("Strat storage is not configured", 503);
  }

  return json({ strat: built.strat }, { status: 201 });
}
