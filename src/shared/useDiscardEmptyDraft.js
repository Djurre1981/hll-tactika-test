import { useEffect, useRef } from "react";
import { apiClient } from "../lib/api-client.js";

function objectsForSlide(slide, { isActive, kernel } = {}) {
  if (isActive && kernel?.getObjects) {
    return kernel.getObjects() || [];
  }
  return Array.isArray(slide?.objects) ? slide.objects : [];
}

/** True when the strat has no real drawing content (fresh untitled draft). */
export function stratSlidesAreEmpty(slides, { activeSlideId, kernel } = {}) {
  const list = Array.isArray(slides) ? slides : [];
  if (list.length === 0) return true;
  if (list.length > 1) return false;
  return !list.some((slide) => {
    const objects = objectsForSlide(slide, {
      isActive: slide?.id === activeSlideId,
      kernel,
    });
    return objects.length > 0;
  });
}

export async function discardDraftRequest(path, { keepalive = false } = {}) {
  try {
    await apiClient(path, { method: "DELETE", keepalive });
  } catch {
    if (!keepalive || typeof fetch !== "function") return;
    try {
      await fetch(`/api${path}`, {
        method: "DELETE",
        credentials: "include",
        keepalive: true,
      });
    } catch {
      /* best-effort on unload */
    }
  }
}

/**
 * When leaving a "discard if empty" draft route, delete the resource if still empty.
 */
export function useDiscardEmptyDraft({ draftKey, enabled, isEmpty, discard }) {
  const enabledRef = useRef(enabled);
  const isEmptyRef = useRef(isEmpty);
  const discardRef = useRef(discard);
  enabledRef.current = enabled;
  isEmptyRef.current = isEmpty;
  discardRef.current = discard;

  useEffect(() => {
    if (!draftKey || !enabled) return undefined;

    const maybeDiscard = (keepalive) => {
      if (!enabledRef.current) return;
      let empty = false;
      try {
        empty = Boolean(isEmptyRef.current?.());
      } catch {
        return;
      }
      if (!empty) return;
      void discardRef.current?.({ keepalive });
    };

    const onLeave = () => maybeDiscard(true);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);

    return () => {
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
      maybeDiscard(false);
    };
  }, [draftKey, enabled]);
}
