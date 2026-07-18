import { requireAuth } from "../../lib/auth-request.js";
import {
  createCollabToken,
  getCollabWsUrl,
} from "../../lib/collab-token.js";
import { errorResponse, json } from "../../lib/response.js";

/**
 * GET /api/collab/debug-ws — probe whether CF-signed token is accepted by Render.
 * Session 431df7 diagnostics.
 */
export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  try {
    const roomId = "presence:site";
    const wsBase = getCollabWsUrl(context.env);
    const token = await createCollabToken(context.env, {
      roomId,
      steamId: auth.session.steamId,
      role: auth.role,
      displayName: auth.session.name || "",
    });

    let protocol = "";
    let host = "";
    try {
      const u = new URL(wsBase);
      protocol = u.protocol;
      host = u.host;
    } catch {
      protocol = "invalid";
    }

    const httpBase = wsBase.replace(/^ws/i, "http");
    const health = await fetch(`${httpBase}/health`, {
      method: "GET",
      cf: { cacheTtl: 0 },
    });
    const healthText = (await health.text()).slice(0, 32);

    // Outbound WebSocket probe (Workers fetch upgrade)
    const wsUrl = `${httpBase.replace(/^http/i, "https")}/collab?room=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`;
    let upgradeStatus = null;
    let upgradeError = null;
    try {
      const resp = await fetch(wsUrl, {
        headers: {
          Upgrade: "websocket",
          Connection: "Upgrade",
        },
      });
      upgradeStatus = resp.status;
      // If CF returns a WebSocket, accept means auth worked
      if (resp.webSocket) {
        try {
          resp.webSocket.accept();
          resp.webSocket.close(1000, "probe");
        } catch {
          /* ignore */
        }
        upgradeStatus = 101;
      }
    } catch (err) {
      upgradeError = String(err?.message || err).slice(0, 120);
    }

    return json({
      ok: true,
      ws: { protocol, host, rawPrefix: String(wsBase).slice(0, 8) },
      health: { status: health.status, body: healthText },
      upgrade: { status: upgradeStatus, error: upgradeError },
      jwtSecretLen: String(context.env.COLLAB_JWT_SECRET || "").length,
      tokenLen: token.length,
    });
  } catch (error) {
    console.error("debug-ws failed:", error);
    return errorResponse(String(error?.message || "debug-ws failed"), 500);
  }
}
