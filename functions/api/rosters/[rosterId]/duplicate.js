import { requireAdmin, readJsonBody } from "../../../lib/auth-request.js";
import { duplicateRoster } from "../../../lib/rosters-store.js";
import { errorResponse, json } from "../../../lib/response.js";

function rosterIdFromContext(context) {
  return String(context.params?.rosterId || "").trim();
}

/** POST /api/rosters/:rosterId/duplicate — copy roster + memberships */
export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const rosterId = rosterIdFromContext(context);
  if (!rosterId) return errorResponse("Missing roster id", 400);

  const parsed = await readJsonBody(context.request);
  if (parsed.error) return parsed.error;

  const name = String(parsed.body?.name || "").trim().slice(0, 80) || null;
  const isTemplate = Boolean(parsed.body?.isTemplate);

  try {
    const result = await duplicateRoster(context.env, rosterId, {
      name,
      isTemplate,
      createdBy: auth.session.steamId,
    });
    if (result.error) return errorResponse(result.error, result.status || 400);
    return json({ roster: result.roster }, { status: 201 });
  } catch (error) {
    console.error("POST /api/rosters/:rosterId/duplicate failed:", error);
    return errorResponse("Failed to duplicate roster", 500);
  }
}
