import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { apiClient } from "../api-client.js";
import { dbgPresence } from "./debugPresence.js";
import { CollabProvider, PRESENCE_ROOM_ID } from "./provider.js";

const KEEPALIVE_MS = 10 * 60 * 1000;
/** Max time to wait on shared wake before opening the WebSocket anyway */
const WAKE_WAIT_MS = 2_500;

/** One in-flight wake shared by all rooms (editors open 2 sockets). */
let sharedWake = null;
let sharedWakeAt = 0;

function wakeCollabServer() {
  const now = Date.now();
  // Reuse a successful wake for a minute so slide switches don't re-block
  if (sharedWake && now - sharedWakeAt < 60_000) return sharedWake;
  sharedWakeAt = now;
  sharedWake = apiClient("/collab/keepalive")
    .catch(() => null)
    .finally(() => {
      /* keep promise cached until TTL via sharedWakeAt */
    });
  return sharedWake;
}

/**
 * Join a collab room: JWT from CF → WS to Render.
 * Reconnects on drop; identity/awareness updates do not tear down the socket.
 * Presence rooms use a server roster (message type 2) so peers stay visible.
 */
export function useYjsRoom({ roomId, enabled = true, awarenessState, user }) {
  const [status, setStatus] = useState("idle");
  const [doc, setDoc] = useState(null);
  const [awareness, setAwareness] = useState(null);
  const [peers, setPeers] = useState([]);
  const providerRef = useRef(null);
  const docRef = useRef(null);
  const awarenessRef = useRef(awarenessState);
  const userRef = useRef(user);
  const reconnectTimer = useRef(null);
  const generationRef = useRef(0);
  const rosterRef = useRef([]);
  const awarenessPeersRef = useRef([]);

  awarenessRef.current = awarenessState;
  userRef.current = user;

  // Keep Render free-tier warm while any collab socket is in use
  useEffect(() => {
    if (!enabled || !user?.steamId) return undefined;
    let cancelled = false;
    const ping = () => {
      if (cancelled) return;
      void wakeCollabServer();
    };
    ping();
    const id = window.setInterval(ping, KEEPALIVE_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, user?.steamId]);

  useEffect(() => {
    if (!enabled || !roomId || !user?.steamId) {
      setStatus("idle");
      setDoc(null);
      setAwareness(null);
      setPeers([]);
      return undefined;
    }

    let cancelled = false;
    const generation = ++generationRef.current;
    const ydoc = new Y.Doc();
    docRef.current = ydoc;
    const useRoster = String(roomId).startsWith("presence:");
    rosterRef.current = [];
    awarenessPeersRef.current = [];

    const publishPeers = () => {
      const self = String(userRef.current?.steamId || "");
      const bySteam = new Map();
      // Awareness fallback (old servers / editor rooms)
      for (const p of awarenessPeersRef.current) {
        if (p?.steamId && String(p.steamId) !== self) {
          bySteam.set(String(p.steamId), p);
        }
      }
      // Server roster wins for presence rooms (JWT-backed)
      if (useRoster) {
        for (const p of rosterRef.current) {
          if (p?.steamId && String(p.steamId) !== self) {
            bySteam.set(String(p.steamId), p);
          }
        }
      }
      const next = Array.from(bySteam.values());
      // #region agent log
      dbgPresence("D", "useYjsRoom.js:publishPeers", "peers published", {
        roomId,
        useRoster,
        rosterCount: rosterRef.current.length,
        awarenessCount: awarenessPeersRef.current.length,
        publishedCount: next.length,
        rosterTails: rosterRef.current.map((p) => String(p.steamId || "").slice(-4)),
        selfTail: self.slice(-4),
      });
      // #endregion
      setPeers(next);
    };

    const refreshAwarenessPeers = (provider) => {
      const states = [];
      provider.awareness.getStates().forEach((value, clientId) => {
        if (clientId === ydoc.clientID) return;
        if (value && value.steamId) {
          const { _t, ...rest } = value;
          void _t;
          states.push({ clientId, ...rest });
        }
      });
      const bySteam = new Map();
      for (const p of states) {
        bySteam.set(String(p.steamId), p);
      }
      awarenessPeersRef.current = Array.from(bySteam.values());
      publishPeers();
    };

    const buildLocalState = () => {
      const u = userRef.current;
      return {
        steamId: u?.steamId || "",
        name: u?.name || "Operator",
        avatar: u?.avatar || null,
        role: u?.role || "",
        ...(awarenessRef.current || {}),
      };
    };

    const stillCurrent = () =>
      !cancelled && generation === generationRef.current;

    const connect = async () => {
      if (!stillCurrent()) return;
      try {
        setStatus((s) =>
          s === "connected" || s === "reconnecting" ? "reconnecting" : "joining"
        );
        // #region agent log
        dbgPresence("A", "useYjsRoom.js:connect", "connect start", {
          roomId,
          useRoster,
        });
        // #endregion
        // Brief shared wake (editors open 2 rooms) — don't block 45s on cold start
        await Promise.race([
          wakeCollabServer(),
          new Promise((resolve) => setTimeout(resolve, WAKE_WAIT_MS)),
        ]);
        if (!stillCurrent()) return;

        const join = await apiClient("/collab/join", {
          method: "POST",
          body: JSON.stringify({ roomId }),
        });
        if (!stillCurrent()) return;
        if (!join || typeof join !== "object" || !join.token || !join.wsUrl) {
          // #region agent log
          dbgPresence("A", "useYjsRoom.js:connect", "invalid join", {
            roomId,
            hasJoin: Boolean(join),
            keys: join && typeof join === "object" ? Object.keys(join) : [],
          });
          // #endregion
          throw new Error("Invalid join response");
        }

        // #region agent log
        let wsHost = "";
        try {
          wsHost = new URL(join.wsUrl).host;
        } catch {
          wsHost = String(join.wsUrl || "").slice(0, 40);
        }
        dbgPresence("A", "useYjsRoom.js:connect", "join ok", {
          roomId,
          wsHost,
          tokenLen: String(join.token || "").length,
        });
        // #endregion

        providerRef.current?.destroy({ silent: true });
        const local = buildLocalState();
        const provider = new CollabProvider({
          doc: ydoc,
          wsUrl: join.wsUrl,
          roomId,
          token: join.token,
          awarenessState: local,
          onRoster: (rosterPeers) => {
            if (!stillCurrent()) return;
            rosterRef.current = Array.isArray(rosterPeers) ? rosterPeers : [];
            // #region agent log
            dbgPresence("C", "useYjsRoom.js:onRoster", "roster callback", {
              roomId,
              count: rosterRef.current.length,
              tails: rosterRef.current.map((p) =>
                String(p.steamId || "").slice(-4)
              ),
            });
            // #endregion
            publishPeers();
          },
          onStatus: (s) => {
            if (!stillCurrent()) return;
            // #region agent log
            dbgPresence("B", "useYjsRoom.js:onStatus", "ws status", {
              roomId,
              status: s,
            });
            // #endregion
            if (s === "connected") {
              setStatus("connected");
              return;
            }
            if (s === "connecting") {
              setStatus((prev) =>
                prev === "connected" || prev === "reconnecting"
                  ? "reconnecting"
                  : "connecting"
              );
              return;
            }
            if (s === "disconnected" || s === "error") {
              setStatus((prev) =>
                prev === "connected" || prev === "reconnecting"
                  ? "reconnecting"
                  : "connecting"
              );
              if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
              reconnectTimer.current = setTimeout(() => {
                void connect();
              }, 1500);
            }
          },
        });
        if (!stillCurrent()) {
          provider.destroy({ silent: true });
          return;
        }
        providerRef.current = provider;
        setDoc(ydoc);
        setAwareness(provider.awareness);
        provider.awareness.on("update", () => refreshAwarenessPeers(provider));
        refreshAwarenessPeers(provider);
      } catch (err) {
        console.error("[collab] join failed:", err);
        // #region agent log
        dbgPresence("A", "useYjsRoom.js:connect", "join failed", {
          roomId,
          err: String(err?.message || err),
        });
        // #endregion
        if (!stillCurrent()) return;
        setStatus("connecting");
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(() => {
          void connect();
        }, 2500);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      providerRef.current?.destroy({ silent: true });
      providerRef.current = null;
      ydoc.destroy();
      docRef.current = null;
      setDoc(null);
      setAwareness(null);
      setPeers([]);
      setStatus("idle");
    };
  }, [roomId, enabled, user?.steamId]);

  // Push awareness + presence hello without reconnecting
  useEffect(() => {
    const provider = providerRef.current;
    if (!provider || (status !== "connected" && status !== "reconnecting")) return;
    const u = user;
    const next = {
      steamId: u?.steamId || "",
      name: u?.name || "Operator",
      avatar: u?.avatar || null,
      role: u?.role || "",
      ...(awarenessState || {}),
      _t: Date.now(),
    };
    provider.awareness.setLocalState(next);
    provider.setPresenceHello(next);
  }, [
    status,
    user?.steamId,
    user?.name,
    user?.avatar,
    user?.role,
    awarenessState?.path,
    awarenessState?.context,
  ]);

  return {
    status,
    doc,
    awareness,
    peers,
    provider: providerRef,
    connected: status === "connected" || status === "reconnecting",
    roomId: roomId || PRESENCE_ROOM_ID,
  };
}
