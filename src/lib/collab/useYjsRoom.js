import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { apiClient } from "../api-client.js";
import { CollabProvider } from "./provider.js";

/**
 * Join a collab room: JWT from CF → WS to Render.
 * @param {object} opts
 * @param {string|null|undefined} opts.roomId
 * @param {boolean} [opts.enabled=true]
 * @param {object} [opts.awarenessState] initial awareness local state
 * @param {object} [opts.user] { steamId, name, avatar, role }
 */
export function useYjsRoom({ roomId, enabled = true, awarenessState, user }) {
  const [status, setStatus] = useState("idle");
  const [doc, setDoc] = useState(null);
  const [awareness, setAwareness] = useState(null);
  const [peers, setPeers] = useState([]);
  const providerRef = useRef(null);
  const docRef = useRef(null);

  useEffect(() => {
    if (!enabled || !roomId) {
      setStatus("idle");
      setDoc(null);
      setAwareness(null);
      setPeers([]);
      return undefined;
    }

    let cancelled = false;
    const ydoc = new Y.Doc();
    docRef.current = ydoc;

    (async () => {
      try {
        setStatus("joining");
        const { token, wsUrl } = await apiClient("/rooms/join", {
          method: "POST",
          body: JSON.stringify({ roomId }),
        });
        if (cancelled) return;

        const state = {
          steamId: user?.steamId || "",
          name: user?.name || "Operator",
          avatar: user?.avatar || null,
          role: user?.role || "",
          ...(awarenessState || {}),
        };

        const provider = new CollabProvider({
          doc: ydoc,
          wsUrl,
          roomId,
          token,
          awarenessState: state,
          onStatus: (s) => {
            if (!cancelled) setStatus(s);
          },
        });
        providerRef.current = provider;
        setDoc(ydoc);
        setAwareness(provider.awareness);

        const refreshPeers = () => {
          const states = [];
          provider.awareness.getStates().forEach((value, clientId) => {
            if (clientId === ydoc.clientID) return;
            if (value && value.steamId) states.push({ clientId, ...value });
          });
          // Dedupe by steamId
          const bySteam = new Map();
          for (const p of states) {
            bySteam.set(p.steamId, p);
          }
          setPeers(Array.from(bySteam.values()));
        };

        provider.awareness.on("change", refreshPeers);
        refreshPeers();
      } catch (err) {
        console.error("[collab] join failed:", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      providerRef.current?.destroy();
      providerRef.current = null;
      ydoc.destroy();
      docRef.current = null;
      setDoc(null);
      setAwareness(null);
      setPeers([]);
      setStatus("idle");
    };
  }, [roomId, enabled, user?.steamId, user?.name, user?.avatar, user?.role]);

  return {
    status,
    doc,
    awareness,
    peers,
    provider: providerRef,
    connected: status === "connected",
  };
}
