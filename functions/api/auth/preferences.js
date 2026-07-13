import { requireAuth } from "../../lib/auth-request.js";
import {
  getUserPreferences,
  normalizeViewerPreferences,
  saveUserPreferences,
  VIEWER_PREFERENCES_DEFAULTS,
} from "../../lib/user-preferences.js";
import { errorResponse, json } from "../../lib/response.js";

export async function onRequestPatch(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("Preferences must be a JSON object", 400);
  }

  const existing =
    (await getUserPreferences(auth.session.steamId, context.env)) ??
    VIEWER_PREFERENCES_DEFAULTS;
  const merged = normalizeViewerPreferences({ ...existing, ...body });

  const result = await saveUserPreferences(
    auth.session.steamId,
    context.env,
    merged
  );
  if (result.error) {
    return errorResponse(result.error, 404);
  }

  return json({ preferences: result.preferences });
}
