import { useEffect, useRef } from "react";

/**
 * Bidirectional sync between Y.Array("objects") and map-kernel slide objects.
 */
export function useKernelYjsBridge({ doc, kernelRef, enabled, canEdit = true, seedObjects }) {
  const applyingRemote = useRef(false);
  const seedRef = useRef(seedObjects);
  seedRef.current = seedObjects;

  useEffect(() => {
    if (!doc || !enabled) return undefined;

    const yObjects = doc.getArray("objects");
    let seeded = false;

    const trySeed = () => {
      if (seeded) return;
      seeded = true;
      if (!canEdit) return;
      const seed = seedRef.current;
      if (yObjects.length === 0 && Array.isArray(seed) && seed.length) {
        doc.transact(() => {
          yObjects.insert(0, seed);
        });
      }
    };

    const seedTimer = setTimeout(trySeed, 400);

    const applyToKernel = () => {
      const kernel = kernelRef.current;
      if (!kernel) return;
      applyingRemote.current = true;
      try {
        kernel.loadSlide(yObjects.toJSON());
      } finally {
        queueMicrotask(() => {
          applyingRemote.current = false;
        });
      }
    };

    const observer = () => {
      if (applyingRemote.current) return;
      applyToKernel();
    };
    yObjects.observeDeep(observer);

    const applyTimer = setTimeout(applyToKernel, 500);

    const prevHandler = kernelRef.current?.onObjectsChange;
    let restored = null;
    const attachTimer = setTimeout(() => {
      const kernel = kernelRef.current;
      if (!kernel || !canEdit) return;
      const prev = kernel.onObjectsChange;
      restored = prev;
      kernel.onObjectsChange = (objects, meta) => {
        prev?.(objects, meta);
        if (applyingRemote.current) return;
        if (meta?.reason === "load") return;
        const next = Array.isArray(objects) ? objects : [];
        doc.transact(() => {
          yObjects.delete(0, yObjects.length);
          if (next.length) yObjects.insert(0, next);
        }, "local-kernel");
      };
    }, 0);

    return () => {
      clearTimeout(seedTimer);
      clearTimeout(applyTimer);
      clearTimeout(attachTimer);
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
        });
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

    yScene.observe(applyRemote);
    const applyTimer = setTimeout(applyRemote, 500);

    return () => {
      clearTimeout(seedTimer);
      clearTimeout(applyTimer);
      yScene.unobserve(applyRemote);
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
