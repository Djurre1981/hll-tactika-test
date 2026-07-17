import { useEffect, useRef } from "react";
import { useEditorStore } from "../../../../lib/stores/useEditorStore.js";

const DEBOUNCE_MS = 1500;

/**
 * Debounced autosave of slide objects into the strat via mutate.
 * `getStratSnapshot` returns the latest strat object (slides included).
 */
export function useStratAutosave({
  enabled,
  kernelRef,
  getStratSnapshot,
  activeSlideId,
  mutateAsync,
}) {
  const timerRef = useRef(null);
  const pendingRef = useRef(false);
  const setDirty = useEditorStore((s) => s.setDirty);

  useEffect(() => {
    const kernel = kernelRef.current;
    if (!kernel || !enabled) return undefined;

    const flush = async () => {
      if (!pendingRef.current) return;
      pendingRef.current = false;
      const strat = getStratSnapshot();
      if (!strat || !activeSlideId) return;

      const objects = kernel.getObjects();
      const slides = (strat.slides || []).map((slide) =>
        slide.id === activeSlideId ? { ...slide, objects } : slide
      );

      try {
        await mutateAsync({ slides });
        setDirty(false);
      } catch (error) {
        console.error("Autosave failed:", error);
        pendingRef.current = true;
      }
    };

    const schedule = () => {
      pendingRef.current = true;
      setDirty(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, DEBOUNCE_MS);
    };

    kernel.onObjectsChange = (_objects, meta) => {
      if (meta?.reason === "load") return;
      schedule();
    };

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      kernel.onObjectsChange = null;
      if (pendingRef.current) {
        void flush();
      }
    };
  }, [enabled, kernelRef, getStratSnapshot, activeSlideId, mutateAsync, setDirty]);
}
