import { useCallback, useEffect, useRef } from "react";

const DEBOUNCE_MS = 1500;

/**
 * Debounced autosave of Excalidraw scene (whiteboard or slideshow).
 * Call `markDirty()` from Excalidraw onChange.
 * `getScene` must return the full persistable scene object.
 */
export function useWhiteboardAutosave({
  enabled,
  getScene,
  backgroundUrl,
  title,
  mutateAsync,
}) {
  const timerRef = useRef(null);
  const pendingRef = useRef(false);
  const getSceneRef = useRef(getScene);
  const metaRef = useRef({ backgroundUrl, title, mutateAsync, enabled });

  getSceneRef.current = getScene;
  metaRef.current = { backgroundUrl, title, mutateAsync, enabled };

  const flush = useCallback(async () => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    const { mutateAsync: mutate, title: t, backgroundUrl: bg, enabled: on } =
      metaRef.current;
    if (!on || !mutate) return;
    const scene = getSceneRef.current?.();

    try {
      await mutate({
        title: t,
        backgroundUrl: bg ?? null,
        ...(scene ? { scene } : {}),
      });
    } catch (error) {
      console.error("Whiteboard autosave failed:", error);
    }
  }, []);

  const markDirty = useCallback(() => {
    if (!metaRef.current.enabled) return;
    pendingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingRef.current) {
        flush();
      }
    };
  }, [flush]);

  return { markDirty, flush };
}
