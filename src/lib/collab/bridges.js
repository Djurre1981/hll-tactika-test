import { useEffect, useRef } from "react";

function fingerprintObjects(objects) {
  try {
    return JSON.stringify(objects || []);
  } catch {
    return "";
  }
}

/**
 * Bidirectional sync between Y.Array("objects") and map-kernel slide objects.
 *
 * Critical: never call kernel.loadSlide() from this bridge. load() clears undo
 * and selection — that made select handles, text edit, icon resize, and undo
 * fail whenever collab was connected (production), while localhost often worked
 * without a live Yjs room.
 */
export function useKernelYjsBridge({ doc, kernelRef, enabled, canEdit = true, seedObjects }) {
  const applyingRemote = useRef(false);
  const seedRef = useRef(seedObjects);
  seedRef.current = seedObjects;

  useEffect(() => {
    if (!doc || !enabled) return undefined;

    const yObjects = doc.getArray("objects");
    let seeded = false;
    let pushTimer = null;

    const trySeed = () => {
      if (seeded) return;
      seeded = true;
      if (!canEdit) return;
      const seed = seedRef.current;
      if (yObjects.length === 0 && Array.isArray(seed) && seed.length) {
        doc.transact(() => {
          yObjects.insert(0, seed);
        }, "local-kernel");
      }
    };

    const seedTimer = setTimeout(trySeed, 400);

    const applyToKernel = () => {
      const kernel = kernelRef.current;
      if (!kernel) return;
      const remote = yObjects.toJSON();
      if (fingerprintObjects(remote) === fingerprintObjects(kernel.getObjects())) {
        return;
      }
      applyingRemote.current = true;
      try {
        kernel.applyRemoteObjects(remote);
      } finally {
        queueMicrotask(() => {
          applyingRemote.current = false;
        });
      }
    };

    // Only peer / server updates. Local writes already live in the kernel.
    const observer = (_events, transaction) => {
      if (applyingRemote.current) return;
      if (transaction?.local) return;
      applyToKernel();
    };
    yObjects.observeDeep(observer);

    const applyTimer = setTimeout(applyToKernel, 500);

    const prevHandler = kernelRef.current?.onObjectsChange;
    let restored = null;

    const pushToYjs = () => {
      const kernel = kernelRef.current;
      if (!kernel || !canEdit || applyingRemote.current) return;
      const next = kernel.getObjects();
      if (fingerprintObjects(next) === fingerprintObjects(yObjects.toJSON())) {
        return;
      }
      doc.transact(() => {
        yObjects.delete(0, yObjects.length);
        if (next.length) yObjects.insert(0, next);
      }, "local-kernel");
    };

    const attachTimer = setTimeout(() => {
      const kernel = kernelRef.current;
      if (!kernel || !canEdit) return;
      const prev = kernel.onObjectsChange;
      restored = prev;
      kernel.onObjectsChange = (objects, meta) => {
        prev?.(objects, meta);
        if (applyingRemote.current) return;
        if (meta?.reason === "load" || meta?.reason === "remote-sync") return;

        // Debounce high-frequency drag updates; flush immediately for structural edits.
        const debounce =
          meta?.reason === "update" || meta?.reason === "drag-end";
        if (pushTimer) clearTimeout(pushTimer);
        if (debounce) {
          pushTimer = setTimeout(pushToYjs, 120);
        } else {
          pushTimer = null;
          pushToYjs();
        }
      };
    }, 0);

    return () => {
      clearTimeout(seedTimer);
      clearTimeout(applyTimer);
      clearTimeout(attachTimer);
      if (pushTimer) clearTimeout(pushTimer);
      yObjects.unobserveDeep(observer);
      const kernel = kernelRef.current;
      if (kernel && canEdit) {
        kernel.onObjectsChange = restored ?? prevHandler ?? null;
      }
    };
  }, [doc, enabled, kernelRef, canEdit]);
}

/**
 * Sync scene object into Y.Map("scene") for Excalidraw whiteboards.
 */
export function useExcalidrawYjsBridge({ doc, enabled, seedScene, onRemoteScene }) {
  const applyingRemote = useRef(false);
  const seedRef = useRef(seedScene);
  seedRef.current = seedScene;
  const onRemoteRef = useRef(onRemoteScene);
  onRemoteRef.current = onRemoteScene;

  useEffect(() => {
    if (!doc || !enabled) return undefined;
    const yScene = doc.getMap("scene");

    const seedTimer = setTimeout(() => {
      if (yScene.size === 0 && seedRef.current && typeof seedRef.current === "object") {
        doc.transact(() => {
          Object.entries(seedRef.current).forEach(([k, v]) => yScene.set(k, v));
        }, "local-excalidraw");
      }
    }, 400);

    const applyRemote = () => {
      applyingRemote.current = true;
      try {
        onRemoteRef.current?.(yScene.toJSON());
      } finally {
        queueMicrotask(() => {
          applyingRemote.current = false;
        });
      }
    };

    // Skip echoing local scene writes (same class of bug as kernel objects).
    const onScene = (_event, transaction) => {
      if (applyingRemote.current) return;
      if (transaction?.local) return;
      applyRemote();
    };
    yScene.observe(onScene);
    const applyTimer = setTimeout(applyRemote, 500);

    return () => {
      clearTimeout(seedTimer);
      clearTimeout(applyTimer);
      yScene.unobserve(onScene);
    };
  }, [doc, enabled]);

  const pushLocalScene = (scene) => {
    if (!doc || !enabled || applyingRemote.current) return;
    const yScene = doc.getMap("scene");
    doc.transact(() => {
      Array.from(yScene.keys()).forEach((k) => {
        if (!(k in (scene || {}))) yScene.delete(k);
      });
      Object.entries(scene || {}).forEach(([k, v]) => yScene.set(k, v));
    }, "local-excalidraw");
  };

  return { pushLocalScene, applyingRemote };
}
