import { requireAuth, readJsonBody } from "../../lib/auth-request.js";
import {
  createCollabToken,
  getCollabWsUrl,
} from "../../lib/collab-token.js";
import { parseRoomId } from "../../lib/collab-rooms.js";
import { getStrat } from "../../lib/strats-store.js";
import { getWhiteboard } from "../../lib/whiteboards-store.js";
import { getLineup } from "../../lib/lineups-store.js";
import { errorResponse, json } from "../../lib/response.js";

async function authorizeRoom(env, roomId, auth) {
  const parsed = parseRoomId(roomId);

  if (parsed.type === "presence") {
    return { ok: true };
  }

  if (parsed.type === "strat-slide") {
    const strat = await getStrat(env, parsed.stratId);
    if (!strat) return { error: errorResponse("Strat not found", 404) };
    const slide = (strat.slides || []).find((s) => s.id === parsed.slideId);
    if (!slide) return { error: errorResponse("Slide not found", 404) };
    return { ok: true, strat, slide };
  }

  if (parsed.type === "whiteboard") {
    const board = await getWhiteboard(env, parsed.whiteboardId);
    if (!board) return { error: errorResponse("Whiteboard not found", 404) };
    return { ok: true, board };
  }

  if (parsed.type === "lineup") {
    const lineup = await getLineup(env, parsed.lineupId);
    if (!lineup) return { error: errorResponse("Lineup not found", 404) };
    return { ok: true, lineup };
  }

  return { error: errorResponse("Invalid room id", 400) };
}

/**
 * POST /api/collab/join — kept outside /api/rooms/:roomId so CF dynamic
 * routes do not swallow the literal "join" segment (was 405).
 */
export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const parsed = await readJsonBody(context.request);
  if (parsed.error) return parsed.error;

  const roomId = String(parsed.body?.roomId || "").trim();
  if (!roomId) return errorResponse("roomId is required", 400);

  try {
    const access = await authorizeRoom(context.env, roomId, auth);
    if (access.error) return access.error;

    const token = await createCollabToken(context.env, {
      roomId,
      steamId: auth.session.steamId,
      role: auth.role,
      displayName: auth.session.name || "",
    });

    return json({
      token,
      wsUrl: getCollabWsUrl(context.env),
      roomId,
    });
  } catch (error) {
    console.error("POST /api/collab/join failed:", error);
    const msg = error?.message || "Collab is not configured";
    if (String(msg).includes("not configured")) {
      return errorResponse(msg, 503);
    }
    return errorResponse("Failed to join room", 500);
  }
}
