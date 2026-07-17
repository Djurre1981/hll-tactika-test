import { guardAccess } from "../../lib/access-guard.js";
import { clearSessionCookie, destroySession, verifySession } from "../../lib/session.js";
import { json } from "../../lib/response.js";

function clientKey(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function onRequestPost(context) {
  const session = await verifySession(context.request, context.env);
  const steamId = session?.steamId || clientKey(context.request);

  const access = await guardAccess(context, {
    bucket: "auth",
    endpoint: "auth.logout",
    steamId,
  });
  if (access.error) {
    return access.error;
  }

  await destroySession(context.request, context.env);
  return json({ ok: true }, {
    headers: { "Set-Cookie": clearSessionCookie(context.request) },
  });
}
