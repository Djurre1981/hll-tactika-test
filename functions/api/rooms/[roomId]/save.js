import { assertPersistAuth } from "../../../lib/collab-token.js";
import {
  isPresenceRoom,
  parseRoomId,
  putYjsSnapshot,
} from "../../../lib/collab-rooms.js";
import { assertLinkedEventEditable } from "../../../lib/event-component-link.js";
import { getStrat, saveStrat } from "../../../lib/strats-store.js";
import { getWhiteboard, saveWhiteboard } from "../../../lib/whiteboards-store.js";
import { errorResponse, json } from "../../../lib/response.js";

function base64ToBytes(b64) {
  const binary = atob(String(b64 || ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function materializeStratSlide(env, parsed, objects) {
  if (!Array.isArray(objects)) return;
  const linked = await assertLinkedEventEditable(env, "strat", parsed.stratId);
  if (linked.error) return;
  const strat = await getStrat(env, parsed.stratId);
  if (!strat) return;
  const slides = (strat.slides || []).map((slide) =>
    slide.id === parsed.slideId ? { ...slide, objects } : slide
  );
  await saveStrat(env, {
    ...strat,
    slides,
    updatedAt: new Date().toISOString(),
  });
}

async function materializeWhiteboard(env, parsed, scene) {
  if (!scene || typeof scene !== "object") return;
  const linked = await assertLinkedEventEditable(env, "whiteboard", parsed.whiteboardId);
  if (linked.error) return;
  const board = await getWhiteboard(env, parsed.whiteboardId);
  if (!board) return;
  await saveWhiteboard(env, {
    ...board,
    scene,
    updatedAt: new Date().toISOString(),
  });
}

export async function onRequestPut(context) {
  try {
    if (!assertPersistAuth(context.request, context.env)) {
      return errorResponse("Unauthorized", 401);
    }
  } catch (error) {
    return errorResponse(error.message || "Collab persist not configured", 503);
  }

  const roomId = decodeURIComponent(context.params.roomId || "");
  if (!roomId) return errorResponse("roomId required", 400);
  if (isPresenceRoom(roomId)) {
    return json({ ok: true, presence: true });
  }

  const parsed = parseRoomId(roomId);
  if (parsed.type === "unknown") {
    return errorResponse("Invalid room id", 400);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  if (!body?.update) {
    return errorResponse("update (base64) is required", 400);
  }

  try {
    const bytes = base64ToBytes(body.update);
    await putYjsSnapshot(context.env, roomId, bytes);

    if (parsed.type === "strat-slide" && body.objects) {
      await materializeStratSlide(context.env, parsed, body.objects);
    }
    if (parsed.type === "whiteboard" && body.scene) {
      await materializeWhiteboard(context.env, parsed, body.scene);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("PUT /api/rooms/:id/save failed:", error);
    return errorResponse("Failed to save room snapshot", 500);
  }
}
