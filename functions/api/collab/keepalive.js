import { getCollabWsUrl } from "../../lib/collab-token.js";
import { errorResponse, json } from "../../lib/response.js";

/**
 * GET /api/collab/keepalive — ping Render /health so free-tier WS stays warm.
 */
export async function onRequestGet(context) {
  try {
    const wsUrl = getCollabWsUrl(context.env);
    const healthUrl = `${wsUrl.replace(/^ws/i, "http")}/health`;
    const res = await fetch(healthUrl, {
      method: "GET",
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    const body = await res.text();
    return json({
      ok: res.ok,
      status: res.status,
      body: String(body || "").slice(0, 32),
      target: healthUrl,
    });
  } catch (error) {
    console.error("GET /api/collab/keepalive failed:", error);
    const msg = error?.message || "Keepalive failed";
    if (String(msg).includes("not configured")) {
      return errorResponse(msg, 503);
    }
    return errorResponse("Keepalive failed", 502);
  }
}
