const PREFIX = "yjs:";

export function yjsKvKey(roomId) {
  return `${PREFIX}${roomId}`;
}

export function isPresenceRoom(roomId) {
  return String(roomId || "").startsWith("presence:");
}

export function parseRoomId(roomId) {
  const id = String(roomId || "");
  if (id.startsWith("presence:")) {
    return { type: "presence", roomId: id };
  }
  if (id.startsWith("wb:")) {
    return { type: "whiteboard", roomId: id, whiteboardId: id.slice(3) };
  }
  const stratMatch = /^strat:([^:]+):slide:([^:]+)$/.exec(id);
  if (stratMatch) {
    return {
      type: "strat-slide",
      roomId: id,
      stratId: stratMatch[1],
      slideId: stratMatch[2],
    };
  }
  return { type: "unknown", roomId: id };
}

export async function getYjsSnapshot(env, roomId) {
  if (!env.PINS_KV || isPresenceRoom(roomId)) return null;
  return env.PINS_KV.get(yjsKvKey(roomId), "arrayBuffer");
}

export async function putYjsSnapshot(env, roomId, bytes) {
  if (!env.PINS_KV || isPresenceRoom(roomId)) return;
  await env.PINS_KV.put(yjsKvKey(roomId), bytes);
}
