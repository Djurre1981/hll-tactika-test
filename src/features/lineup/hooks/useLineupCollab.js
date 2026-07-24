import { useCallback, useEffect, useRef } from "react";
import { useYjsRoom } from "../../../lib/collab/useYjsRoom.js";

/**
 * Sync lineup.layout via Yjs map key "layout".
 * Local writes update Ydoc; remote updates call onRemoteLayout.
 */
export function useLineupCollab({
  lineupId,
  enabled,
  user,
  canWrite,
  onRemoteLayout,
}) {
  const roomId = lineupId ? `lineup:${lineupId}` : null;
  const applyingRemote = useRef(false);
  const onRemoteRef = useRef(onRemoteLayout);
  onRemoteRef.current = onRemoteLayout;

  const collab = useYjsRoom({
    roomId,
    enabled: Boolean(enabled && roomId && user?.steamId),
    user,
    awarenessState: {
      tool: "lineup",
      canWrite: Boolean(canWrite),
    },
  });

  useEffect(() => {
    const doc = collab.doc;
    if (!doc) return undefined;

    const map = doc.getMap("lineup");
    const handle = () => {
      const layout = map.get("layout");
      if (!layout || typeof layout !== "object") return;
      const remoteUpdatedAt = map.get("updatedAt");
      applyingRemote.current = true;
      try {
        onRemoteRef.current?.(JSON.parse(JSON.stringify(layout)), {
          updatedAt: remoteUpdatedAt || null,
        });
      } finally {
        queueMicrotask(() => {
          applyingRemote.current = false;
        });
      }
    };

    map.observe(handle);
    handle();
    return () => map.unobserve(handle);
  }, [collab.doc]);

  const publishLayout = useCallback(
    (layout, updatedAt = null) => {
      if (!canWrite || !collab.doc || applyingRemote.current) return;
      const map = collab.doc.getMap("lineup");
      collab.doc.transact(() => {
        map.set("layout", JSON.parse(JSON.stringify(layout)));
        if (updatedAt) map.set("updatedAt", updatedAt);
      });
    },
    [canWrite, collab.doc]
  );

  const seedIfEmpty = useCallback(
    (layout, updatedAt = null) => {
      if (!canWrite || !collab.doc || !layout) return;
      const map = collab.doc.getMap("lineup");
      if (map.get("layout")) return;
      collab.doc.transact(() => {
        map.set("layout", JSON.parse(JSON.stringify(layout)));
        if (updatedAt) map.set("updatedAt", updatedAt);
      });
    },
    [canWrite, collab.doc]
  );

  /** Force-replace collab layout (e.g. after Reset layout). */
  const forcePublishLayout = useCallback(
    (layout, updatedAt = null) => {
      if (!canWrite || !collab.doc || !layout) return;
      const map = collab.doc.getMap("lineup");
      collab.doc.transact(() => {
        map.set("layout", JSON.parse(JSON.stringify(layout)));
        if (updatedAt) map.set("updatedAt", updatedAt);
      });
    },
    [canWrite, collab.doc]
  );

  return {
    status: collab.status,
    peers: collab.peers,
    publishLayout,
    seedIfEmpty,
    forcePublishLayout,
  };
}
