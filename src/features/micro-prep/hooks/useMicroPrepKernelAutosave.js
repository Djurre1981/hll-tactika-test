import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 1500;

/**
 * Debounced autosave of map-kernel objects + scene metadata for micro-prep boards.
 */
export function useMicroPrepKernelAutosave({
  enabled,
  kernelRef,
  getPersistPayload,
  mutateAsync,
}) {
  const timerRef = useRef(null);
  const pendingRef = useRef(false);
  const getPayloadRef = useRef(getPersistPayload);
  const enabledRef = useRef(enabled);

  getPayloadRef.current = getPersistPayload;
  enabledRef.current = enabled;

  useEffect(() => {
    const kernel = kernelRef.current;
    if (!kernel || !enabled) return undefined;

    const flush = async () => {
      if (!pendingRef.current) return;
      pendingRef.current = false;
      const payload = getPayloadRef.current?.();
      if (!payload || !enabledRef.current) return;

      try {
        await mutateAsync(payload);
      } catch (error) {
        console.error("Micro-prep autosave failed:", error);
        pendingRef.current = true;
      }
    };

    const schedule = () => {
      if (!enabledRef.current) return;
      pendingRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, DEBOUNCE_MS);
    };

    kernel.onObjectsChange = (_objects, meta) => {
      if (meta?.reason === "load" || meta?.reason === "remote-sync") return;
      schedule();
    };

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      kernel.onObjectsChange = null;
      if (pendingRef.current) {
        void flush();
      }
    };
  }, [enabled, kernelRef, mutateAsync]);
}
