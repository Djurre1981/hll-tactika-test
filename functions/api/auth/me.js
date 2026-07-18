import { getUserRole } from "../../lib/roles.js";
import { getUserPreferences } from "../../lib/user-preferences.js";
import { verifySession } from "../../lib/session.js";
import { json } from "../../lib/response.js";

export async function onRequestGet(context) {
  const session = await verifySession(context.request, context.env);
  if (!session) {
    return json({ authenticated: false }, { status: 401 });
  }

  const role = await getUserRole(session.steamId, context.env);
  if (!role) {
    return json({ authenticated: false, forbidden: true }, { status: 403 });
  }

  const preferences = await getUserPreferences(session.steamId, context.env);
  const body = {
    authenticated: true,
    steamId: session.steamId,
    name: session.name,
    avatar: session.avatar,
    role,
  };
  if (preferences) {
    body.preferences = preferences;
  }
  return json(body);
}
