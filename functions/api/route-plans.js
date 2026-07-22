import { requireAuth } from "../lib/auth-request.js";
import { resolveCreatorName } from "../lib/pin-creators.js";
import { canEnterEditorMode } from "../lib/pin-permissions.js";
import { saveRoutePlan, listRoutePlans } from "../lib/route-plans-store.js";
import { errorResponse, json } from "../lib/response.js";

function sanitizePlanInput(input) {
  const title =
    typeof input.title === "string" && input.title.trim()
      ? input.title.trim().slice(0, 200)
      : "Untitled route plan";
  const plan =
    input.plan && typeof input.plan === "object" && !Array.isArray(input.plan)
      ? input.plan
      : {};
  return { title, plan };
}

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  try {
    const plans = await listRoutePlans(context.env);
    return json({ plans });
  } catch (error) {
    console.error("GET /api/route-plans failed:", error);
    return errorResponse("Route plan storage is not configured", 503);
  }
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  if (!canEnterEditorMode(auth.role)) {
    return errorResponse("Editor access required", 403);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { title, plan } = sanitizePlanInput(body.plan || body);
  const createdByName = await resolveCreatorName(
    auth.session.steamId,
    context.env,
    auth.session
  );
  const now = new Date().toISOString();

  try {
    const record = await saveRoutePlan(context.env, {
      id: `routeplan-${crypto.randomUUID()}`,
      title,
      plan,
      createdBy: auth.session.steamId,
      createdByName,
      createdAt: now,
      updatedAt: now,
    });
    return json({ plan: record }, { status: 201 });
  } catch (error) {
    console.error("POST /api/route-plans failed:", error);
    return errorResponse("Route plan storage is not configured", 503);
  }
}
