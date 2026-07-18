import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { dbgPresence } from "./debugPresence.js";

const messageSync = 0;
const messageAwareness = 1;
const messagePresence = 2;

/**
 * Minimal y-websocket-compatible provider against our Render /collab endpoint.
 */
export class CollabProvider {
  /**
   * @param {object} opts
   * @param {Y.Doc} opts.doc
   * @param {string} opts.wsUrl  e.g. wss://host (no path)
   * @param {string} opts.roomId
   * @param {string} opts.token
   * @param {object} [opts.awarenessState]
   * @param {(status: string) => void} [opts.onStatus]
   * @param {(peers: object[]) => void} [opts.onRoster]
   */
  constructor({ doc, wsUrl, roomId, token, awarenessState, onStatus, onRoster }) {
    this.doc = doc;
    this.awareness = new awarenessProtocol.Awareness(doc);
    this.roomId = roomId;
    this.onStatus = onStatus || (() => {});
    this.onRoster = onRoster || (() => {});
    this.closed = false;
    this.ws = null;
    this._rosterPeers = new Map();
    this._presenceHello = awarenessState || null;

    if (awarenessState) {
      this.awareness.setLocalState(awarenessState);
    }

    const base = String(wsUrl || "").replace(/\/+$/, "");
    const url = `${base}/collab?room=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`;

    this._updateHandler = (update, origin) => {
      if (origin === this || this.closed || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      this.ws.send(encoding.toUint8Array(encoder));
    };

    this._awarenessHandler = ({ added, updated, removed }, origin) => {
      if (origin === this || this.closed || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }
      const changed = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed)
      );
      this.ws.send(encoding.toUint8Array(encoder));
    };

    this.doc.on("update", this._updateHandler);
    this.awareness.on("update", this._awarenessHandler);
    this._heartbeat = null;

    this.onStatus("connecting");
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    this.ws.addEventListener("open", () => {
      this.onStatus("connected");
      // sync step 1
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeSyncStep1(encoder, this.doc);
      this.ws.send(encoding.toUint8Array(encoder));

      // Re-announce local awareness now that the socket is open
      this._announceAwareness();
      this._sendPresenceHello();
      // y-protocols drops peers after ~30s without updates — refresh often
      if (this._heartbeat) clearInterval(this._heartbeat);
      this._heartbeat = setInterval(() => {
        this._announceAwareness();
        this._sendPresenceHello();
      }, 15_000);
    });

    this.ws.addEventListener("close", () => {
      this.onStatus("disconnected");
    });

    this.ws.addEventListener("error", () => {
      // close always follows; avoid double reconnect scheduling from error+close
    });

    this.ws.addEventListener("message", (event) => {
      try {
        const bytes = new Uint8Array(event.data);
        const decoder = decoding.createDecoder(bytes);
        const messageType = decoding.readVarUint(decoder);
        switch (messageType) {
          case messageSync: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, messageSync);
            syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);
            if (encoding.length(encoder) > 1) {
              this.ws.send(encoding.toUint8Array(encoder));
            }
            break;
          }
          case messageAwareness: {
            awarenessProtocol.applyAwarenessUpdate(
              this.awareness,
              decoding.readVarUint8Array(decoder),
              this
            );
            break;
          }
          case messagePresence: {
            this._handlePresence(JSON.parse(decoding.readVarString(decoder)));
            break;
          }
          default:
            break;
        }
      } catch (err) {
        console.error("[collab] client message error:", err);
      }
    });
  }

  setAwarenessField(field, value) {
    const prev = this.awareness.getLocalState() || {};
    this.awareness.setLocalState({ ...prev, [field]: value });
  }

  setPresenceHello(state) {
    this._presenceHello = state;
    this._sendPresenceHello();
  }

  _sendPresenceHello() {
    if (this.closed || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const state = this._presenceHello || this.awareness.getLocalState() || {};
    if (!state.steamId) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messagePresence);
    encoding.writeVarString(
      encoder,
      JSON.stringify({
        type: "hello",
        steamId: state.steamId,
        name: state.name || "",
        avatar: state.avatar || null,
        role: state.role || "",
        context: state.context || "hub",
        path: state.path || "",
      })
    );
    this.ws.send(encoding.toUint8Array(encoder));
  }

  _emitRoster() {
    this.onRoster(Array.from(this._rosterPeers.values()));
  }

  _handlePresence(body) {
    if (!body || typeof body !== "object") return;
    // #region agent log
    dbgPresence("C", "provider.js:_handlePresence", "presence msg", {
      roomId: this.roomId,
      type: body.type,
      peerCount: Array.isArray(body.peers) ? body.peers.length : undefined,
      peerTail: body.peer?.steamId
        ? String(body.peer.steamId).slice(-4)
        : undefined,
      leaveTail: body.steamId ? String(body.steamId).slice(-4) : undefined,
    });
    // #endregion
    if (body.type === "roster" && Array.isArray(body.peers)) {
      this._rosterPeers.clear();
      for (const peer of body.peers) {
        if (peer?.steamId) this._rosterPeers.set(String(peer.steamId), peer);
      }
      this._emitRoster();
      return;
    }
    if (body.type === "join" && body.peer?.steamId) {
      this._rosterPeers.set(String(body.peer.steamId), body.peer);
      this._emitRoster();
      return;
    }
    if (body.type === "leave" && body.steamId) {
      this._rosterPeers.delete(String(body.steamId));
      this._emitRoster();
    }
  }

  _announceAwareness() {
    if (this.closed || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const prev = this.awareness.getLocalState() || {};
    // Touch local state so lastUpdated refreshes on peers/server
    this.awareness.setLocalState({ ...prev, _t: Date.now() });
  }

  destroy({ silent = false } = {}) {
    this.closed = true;
    if (this._heartbeat) {
      clearInterval(this._heartbeat);
      this._heartbeat = null;
    }
    this.doc.off("update", this._updateHandler);
    this.awareness.off("update", this._awarenessHandler);
    awarenessProtocol.removeAwarenessStates(
      this.awareness,
      [this.doc.clientID],
      "local"
    );
    if (silent) {
      this.onStatus = () => {};
      this.onRoster = () => {};
    }
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
  }
}

export function stratSlideRoomId(stratId, slideId) {
  return `strat:${stratId}:slide:${slideId}`;
}

export function whiteboardRoomId(boardId) {
  return `wb:${boardId}`;
}

export const PRESENCE_ROOM_ID = "presence:site";
