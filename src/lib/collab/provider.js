import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const messageSync = 0;
const messageAwareness = 1;

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
   */
  constructor({ doc, wsUrl, roomId, token, awarenessState, onStatus }) {
    this.doc = doc;
    this.awareness = new awarenessProtocol.Awareness(doc);
    this.roomId = roomId;
    this.onStatus = onStatus || (() => {});
    this.closed = false;
    this.ws = null;

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
      // y-protocols drops peers after ~30s without updates — refresh often
      if (this._heartbeat) clearInterval(this._heartbeat);
      this._heartbeat = setInterval(() => this._announceAwareness(), 15_000);
    });

    this.ws.addEventListener("close", () => {
      this.onStatus("disconnected");
    });

    this.ws.addEventListener("error", () => {
      this.onStatus("error");
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
