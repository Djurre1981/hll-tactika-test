import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { loadRoomSnapshot, saveRoomSnapshot, isPresenceRoom } from "./persist.js";

const messageSync = 0;
const messageAwareness = 1;
/** Site presence roster (JWT-backed) — not Yjs awareness */
const messagePresence = 2;

const IDLE_SAVE_MS = 30_000;
const EMPTY_GRACE_MS = 5 * 60_000;

/** @type {Map<string, RoomState>} */
const rooms = new Map();

/**
 * @typedef {object} RosterPeer
 * @property {string} steamId
 * @property {string} name
 * @property {string|null} avatar
 * @property {string} role
 * @property {string} [context]
 * @property {string} [path]
 * @property {Set<import('ws').WebSocket>} sockets
 */

/**
 * @typedef {object} RoomState
 * @property {string} id
 * @property {Y.Doc} doc
 * @property {awarenessProtocol.Awareness} awareness
 * @property {Set<import('ws').WebSocket>} sockets
 * @property {Map<string, RosterPeer>} [roster]
 * @property {ReturnType<typeof setTimeout>|null} idleTimer
 * @property {ReturnType<typeof setTimeout>|null} emptyTimer
 * @property {boolean} dirty
 * @property {Promise<void>} ready
 */

function encodePresence(payload) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messagePresence);
  encoding.writeVarString(encoder, JSON.stringify(payload));
  return encoding.toUint8Array(encoder);
}

function peerPublic(peer) {
  return {
    steamId: peer.steamId,
    name: peer.name,
    avatar: peer.avatar,
    role: peer.role,
    context: peer.context || "hub",
    path: peer.path || "",
  };
}

function rosterSnapshot(room) {
  return {
    type: "roster",
    peers: [...(room.roster?.values() || [])].map(peerPublic),
  };
}

function getObjectsFromDoc(doc) {
  try {
    const arr = doc.getArray("objects");
    return arr.toJSON();
  } catch {
    return null;
  }
}

function getSceneFromDoc(doc) {
  try {
    const map = doc.getMap("scene");
    return map.toJSON();
  } catch {
    return null;
  }
}

async function persistRoom(room) {
  if (isPresenceRoom(room.id) || !room.dirty) return;
  const update = Y.encodeStateAsUpdate(room.doc);
  const meta = {};
  if (room.id.startsWith("strat:")) {
    const objects = getObjectsFromDoc(room.doc);
    if (Array.isArray(objects)) meta.objects = objects;
  } else if (room.id.startsWith("wb:")) {
    const scene = getSceneFromDoc(room.doc);
    if (scene && typeof scene === "object") meta.scene = scene;
  } else if (room.id.startsWith("lineup:")) {
    try {
      const layout = room.doc.getMap("lineup").get("layout");
      if (layout && typeof layout === "object") meta.layout = layout;
    } catch {
      /* ignore */
    }
  }
  await saveRoomSnapshot(room.id, update, meta);
  room.dirty = false;
  console.log(`[collab] saved ${room.id}`);
}

function scheduleIdleSave(room) {
  if (isPresenceRoom(room.id)) return;
  if (room.idleTimer) clearTimeout(room.idleTimer);
  room.idleTimer = setTimeout(() => {
    room.idleTimer = null;
    persistRoom(room).catch((err) =>
      console.error(`[collab] idle save failed ${room.id}:`, err)
    );
  }, IDLE_SAVE_MS);
}

function broadcast(room, exclude, data) {
  for (const ws of room.sockets) {
    if (ws !== exclude && ws.readyState === 1) {
      ws.send(data);
    }
  }
}

async function createRoom(roomId) {
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  /** @type {RoomState} */
  const room = {
    id: roomId,
    doc,
    awareness,
    sockets: new Set(),
    roster: isPresenceRoom(roomId) ? new Map() : undefined,
    idleTimer: null,
    emptyTimer: null,
    dirty: false,
    ready: Promise.resolve(),
  };

  room.ready = (async () => {
    try {
      const snapshot = await loadRoomSnapshot(roomId);
      if (snapshot?.length) {
        Y.applyUpdate(doc, new Uint8Array(snapshot));
        console.log(`[collab] loaded ${roomId} (${snapshot.length} bytes)`);
      }
    } catch (err) {
      console.error(`[collab] load failed ${roomId}:`, err);
    }
  })();

  doc.on("update", (update, origin) => {
    if (isPresenceRoom(roomId)) return;
    room.dirty = true;
    scheduleIdleSave(room);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const msg = encoding.toUint8Array(encoder);
    broadcast(room, origin, msg);
  });

  awareness.on("update", ({ added, updated, removed }, origin) => {
    const changed = added.concat(updated, removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changed)
    );
    broadcast(room, origin, encoding.toUint8Array(encoder));
  });

  rooms.set(roomId, room);
  return room;
}

function trackControlledIds(ws, controlledIds, { added, updated }) {
  for (const id of added.concat(updated)) {
    controlledIds.add(id);
  }
  ws._controlledAwarenessIds = controlledIds;
}

export async function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = await createRoom(roomId);
  }
  await room.ready;
  return room;
}

/**
 * @param {RoomState} room
 * @param {import('ws').WebSocket} ws
 * @param {{ steamId: string, role: string, displayName?: string }} identity
 */
export function attachClient(room, ws, identity) {
  if (room.emptyTimer) {
    clearTimeout(room.emptyTimer);
    room.emptyTimer = null;
  }

  room.sockets.add(ws);
  ws.binaryType = "arraybuffer";
  /** @type {Set<number>} */
  const controlledIds = new Set();
  const steamId = String(identity?.steamId || "").trim();
  const isPresence = Boolean(room.roster) && Boolean(steamId);

  const onAwareness = ({ added, updated }, origin) => {
    if (origin === ws) trackControlledIds(ws, controlledIds, { added, updated });
  };
  room.awareness.on("update", onAwareness);

  if (isPresence) {
    let peer = room.roster.get(steamId);
    if (!peer) {
      peer = {
        steamId,
        name: identity.displayName || steamId,
        avatar: null,
        role: identity.role || "",
        context: "hub",
        path: "",
        sockets: new Set(),
      };
      room.roster.set(steamId, peer);
    } else if (identity.displayName) {
      peer.name = identity.displayName;
    }
    peer.sockets.add(ws);
    ws.send(encodePresence(rosterSnapshot(room)));
    broadcast(room, ws, encodePresence({ type: "join", peer: peerPublic(peer) }));
  }

  ws.on("message", (data) => {
    try {
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data);
      const decoder = decoding.createDecoder(bytes);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case messageSync: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws);
          if (encoding.length(encoder) > 1) {
            ws.send(encoding.toUint8Array(encoder));
          }
          break;
        }
        case messageAwareness: {
          awarenessProtocol.applyAwarenessUpdate(
            room.awareness,
            decoding.readVarUint8Array(decoder),
            ws
          );
          break;
        }
        case messagePresence: {
          if (!isPresence) break;
          let body;
          try {
            body = JSON.parse(decoding.readVarString(decoder));
          } catch {
            break;
          }
          if (!body || body.type !== "hello") break;
          const peer = room.roster.get(steamId);
          if (!peer) break;
          if (typeof body.name === "string" && body.name.trim()) {
            peer.name = body.name.trim().slice(0, 80);
          }
          if (body.avatar === null || typeof body.avatar === "string") {
            peer.avatar = body.avatar ? String(body.avatar).slice(0, 500) : null;
          }
          if (typeof body.context === "string") {
            peer.context = body.context.slice(0, 40);
          }
          if (typeof body.path === "string") {
            peer.path = body.path.slice(0, 200);
          }
          if (typeof body.role === "string") {
            peer.role = body.role.slice(0, 32);
          }
          const msg = encodePresence({ type: "join", peer: peerPublic(peer) });
          // Include sender so their own UI can reconcile
          for (const sock of room.sockets) {
            if (sock.readyState === 1) sock.send(msg);
          }
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error(`[collab] message error ${room.id}:`, err);
    }
  });

  ws.on("close", () => {
    room.awareness.off("update", onAwareness);
    room.sockets.delete(ws);
    if (controlledIds.size) {
      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        Array.from(controlledIds),
        "disconnect"
      );
    }

    if (isPresence) {
      const peer = room.roster.get(steamId);
      if (peer) {
        peer.sockets.delete(ws);
        if (peer.sockets.size === 0) {
          room.roster.delete(steamId);
          broadcast(room, null, encodePresence({ type: "leave", steamId }));
        }
      }
    }

    if (room.sockets.size === 0) {
      room.emptyTimer = setTimeout(() => {
        persistRoom(room)
          .catch((err) => console.error(`[collab] teardown save ${room.id}:`, err))
          .finally(() => {
            if (room.sockets.size === 0) {
              room.doc.destroy();
              rooms.delete(room.id);
              console.log(`[collab] destroyed ${room.id}`);
            }
          });
      }, EMPTY_GRACE_MS);
    }
  });

  // Initial sync step 1
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, room.doc);
    ws.send(encoding.toUint8Array(encoder));
  }

  // Send current awareness
  const states = Array.from(room.awareness.getStates().keys());
  if (states.length) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, states)
    );
    ws.send(encoding.toUint8Array(encoder));
  }
}

export async function flushAllRooms() {
  const tasks = [];
  for (const room of rooms.values()) {
    tasks.push(persistRoom(room));
  }
  await Promise.allSettled(tasks);
}
