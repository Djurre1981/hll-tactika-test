import { assertPersistAuth } from "../../../lib/collab-token.js";
import { getYjsSnapshot, isPresenceRoom, parseRoomId } from "../../../lib/collab-rooms.js";
import { errorResponse, json } from "../../../lib/response.js";

export async function onRequestGet(context) {
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
    return json({ update: null, presence: true });
  }

  const parsed = parseRoomId(roomId);
  if (parsed.type === "unknown") {
    return errorResponse("Invalid room id", 400);
  }

  try {
    const buf = await getYjsSnapshot(context.env, roomId);
    if (!buf) {
      return json({ update: null }, { status: 404 });
    }
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return json({ update: btoa(binary) });
  } catch (error) {
    console.error("GET /api/rooms/:id/load failed:", error);
    return errorResponse("Failed to load room snapshot", 500);
  }
}
