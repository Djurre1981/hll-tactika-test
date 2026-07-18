import { getUserRole } from "../../lib/roles.js";
import { redirect } from "../../lib/response.js";
import { createSessionCookie } from "../../lib/session.js";
import { cacheSteamProfile, fetchSteamProfile, getOrigin, verifySteamCallback } from "../../lib/steam.js";
import { recordUserLastSignedIn } from "../../lib/users-store.js";

function clientKey(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const steamId = await verifySteamCallback(request);
    const profile = await fetchSteamProfile(steamId, env);
    await cacheSteamProfile(profile, env);

    const role = await getUserRole(steamId, env);
    if (!role) {
      const origin = getOrigin(request);
      return redirect(`${origin}/?auth=forbidden&steamId=${steamId}`);
    }

    await recordUserLastSignedIn(steamId, env, profile, role);

    const cookie = await createSessionCookie(profile, env, request);
    return redirect(`${getOrigin(request)}/`, {
      headers: { "Set-Cookie": cookie },
    });
  } catch (error) {
    console.error("Steam callback failed:", error);
    const origin = getOrigin(request);
    return redirect(`${origin}/?auth=error`);
  }
}
