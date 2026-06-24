import { requireAdmin } from "../../../lib/auth-request.js";
import { removeManagedUser } from "../../../lib/roles.js";
import { isValidSteamId64 } from "../../../lib/users-store.js";
import { errorResponse, json } from "../../../lib/response.js";

export async function onRequestDelete(context) {
  const auth = await requireAdmin(context);
  if (auth.error) {
    return auth.error;
  }

  const steamId = String(context.params.steamId || "").trim();
  if (!isValidSteamId64(steamId)) {
    return errorResponse("Invalid Steam ID64", 400);
  }

  const result = await removeManagedUser(context.env, steamId);
  if (result.error) {
    const status = result.error === "User not found" ? 404 : 403;
    return errorResponse(result.error, status);
  }

  return json({ ok: true, steamId });
}
