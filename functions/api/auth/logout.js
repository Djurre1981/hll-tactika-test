import { clearSessionCookie, destroySession } from "../../lib/session.js";
import { json } from "../../lib/response.js";

export async function onRequestPost(context) {
  await destroySession(context.request, context.env);
  return json({ ok: true }, {
    headers: { "Set-Cookie": clearSessionCookie(context.request) },
  });
}
