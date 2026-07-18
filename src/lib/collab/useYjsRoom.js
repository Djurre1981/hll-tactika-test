import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { apiClient } from "../api-client.js";
import { CollabProvider, PRESENCE_ROOM_ID } from "./provider.js";

const KEEPALIVE_MS = 10 * 60 * 1000;

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
  const connectLock = useRef(false);
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
      void apiClient("/collab/keepalive").catch(() => {});
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
      setPeers(Array.from(bySteam.values()));
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

    const connect = async () => {
      if (cancelled || generation !== generationRef.current) return;
      if (connectLock.current) return;
      connectLock.current = true;
      try {
        setStatus((s) =>
          s === "connected" || s === "reconnecting" ? "reconnecting" : "joining"
        );
        const join = await apiClient("/collab/join", {
          method: "POST",
          body: JSON.stringify({ roomId }),
        });
        if (cancelled || generation !== generationRef.current) return;
        if (!join || typeof join !== "object" || !join.token || !join.wsUrl) {
          throw new Error("Invalid join response");
        }

        providerRef.current?.destroy({ silent: true });
        const local = buildLocalState();
        const provider = new CollabProvider({
          doc: ydoc,
          wsUrl: join.wsUrl,
          roomId,
          token: join.token,
          awarenessState: local,
          onRoster: (rosterPeers) => {
            if (cancelled || generation !== generationRef.current) return;
            rosterRef.current = Array.isArray(rosterPeers) ? rosterPeers : [];
            publishPeers();
          },
          onStatus: (s) => {
            if (cancelled || generation !== generationRef.current) return;
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
        providerRef.current = provider;
        setDoc(ydoc);
        setAwareness(provider.awareness);
        provider.awareness.on("update", () => refreshAwarenessPeers(provider));
        refreshAwarenessPeers(provider);
      } catch (err) {
        console.error("[collab] join failed:", err);
        if (cancelled || generation !== generationRef.current) return;
        setStatus("connecting");
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(() => {
          void connect();
        }, 2500);
      } finally {
        connectLock.current = false;
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
