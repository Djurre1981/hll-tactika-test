import { requireAuth, readJsonBody } from "../../lib/auth-request.js";
import { errorResponse, json } from "../../lib/response.js";

const KEY = "debug:presence:431df7";
const MAX = 80;

/**
 * Temporary debug sink for presence investigation (session 431df7).
 * POST appends an event; GET returns recent events.
 */
export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;
  if (!context.env.PINS_KV) return errorResponse("KV unavailable", 503);

  const parsed = await readJsonBody(context.request);
  if (parsed.error) return parsed.error;

  const event = {
    ...(parsed.body && typeof parsed.body === "object" ? parsed.body : {}),
    steamTail: String(auth.session?.steamId || "").slice(-4),
    at: Date.now(),
  };
  delete event.token;
  delete event.password;

  try {
    const prev = (await context.env.PINS_KV.get(KEY, "json")) || { events: [] };
    const events = Array.isArray(prev.events) ? prev.events : [];
    events.push(event);
    await context.env.PINS_KV.put(
      KEY,
      JSON.stringify({ events: events.slice(-MAX) }),
      { expirationTtl: 3600 }
    );
    return json({ ok: true });
  } catch (error) {
    console.error("debug-log post failed:", error);
    return errorResponse("debug-log failed", 500);
  }
}

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;
  if (!context.env.PINS_KV) return errorResponse("KV unavailable", 503);
  try {
    const data = (await context.env.PINS_KV.get(KEY, "json")) || { events: [] };
    return json(data);
  } catch (error) {
    console.error("debug-log get failed:", error);
    return errorResponse("debug-log failed", 500);
  }
}
