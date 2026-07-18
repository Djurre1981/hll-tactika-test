import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { apiClient } from "../api-client.js";
import { CollabProvider } from "./provider.js";

/**
 * Join a collab room: JWT from CF → WS to Render.
 * Reconnects on drop; identity/awareness updates do not tear down the socket.
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

  awarenessRef.current = awarenessState;
  userRef.current = user;

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

    const refreshPeers = (provider) => {
      const states = [];
      provider.awareness.getStates().forEach((value, clientId) => {
        if (clientId === ydoc.clientID) return;
        if (value && value.steamId) states.push({ clientId, ...value });
      });
      const bySteam = new Map();
      for (const p of states) {
        bySteam.set(p.steamId, p);
      }
      setPeers(Array.from(bySteam.values()));
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
      try {
        setStatus((s) => (s === "connected" ? s : "joining"));
        const join = await apiClient("/collab/join", {
          method: "POST",
          body: JSON.stringify({ roomId }),
        });
        if (cancelled || generation !== generationRef.current) return;
        if (!join || typeof join !== "object" || !join.token || !join.wsUrl) {
          throw new Error("Invalid join response");
        }

        providerRef.current?.destroy({ silent: true });
        const provider = new CollabProvider({
          doc: ydoc,
          wsUrl: join.wsUrl,
          roomId,
          token: join.token,
          awarenessState: buildLocalState(),
          onStatus: (s) => {
            if (cancelled || generation !== generationRef.current) return;
            if (s === "connected") {
              setStatus("connected");
              return;
            }
            if (s === "connecting") {
              setStatus("connecting");
              return;
            }
            // Dropped — schedule reconnect instead of sticky red
            if (s === "disconnected" || s === "error") {
              setStatus("connecting");
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
        provider.awareness.on("change", () => refreshPeers(provider));
        refreshPeers(provider);
      } catch (err) {
        console.error("[collab] join failed:", err);
        if (cancelled || generation !== generationRef.current) return;
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

  // Push awareness field updates without reconnecting
  useEffect(() => {
    const provider = providerRef.current;
    if (!provider || status !== "connected") return;
    const u = user;
    provider.awareness.setLocalState({
      steamId: u?.steamId || "",
      name: u?.name || "Operator",
      avatar: u?.avatar || null,
      role: u?.role || "",
      ...(awarenessState || {}),
    });
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
    connected: status === "connected",
  };
}
