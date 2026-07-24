import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthGate.jsx";
import { useEditorStore } from "../../../../lib/stores/useEditorStore.js";
import { apiClient } from "../../../../lib/api-client.js";
import { queryKeys } from "../../../../lib/query-keys.js";
import { useKernelYjsBridge } from "../../../../lib/collab/bridges.js";
import { PRESENCE_ROOM_ID, stratSlideRoomId } from "../../../../lib/collab/provider.js";
import { useYjsRoom } from "../../../../lib/collab/useYjsRoom.js";
import { useMutateStrat } from "./useMutateStrat.js";
import { useStratAutosave } from "./useStratAutosave.js";
import { useStratQuery } from "./useStratQuery.js";
import { useLinkedEventLock } from "../../../events/hooks/useLinkedEventLock.js";
import { canManageToolLock, isToolLocked } from "../../../../lib/tool-lock.js";
import { getDefaultMapId, rememberMapId } from "../mapIds.js";
import { STRAT_RASTER_FIT_DEFAULT } from "../stratBackground.js";
import { prepareImageUpload, uploadImageFile } from "../../../../shared/prepareImageUpload.js";
import {
  discardDraftRequest,
  stratSlidesAreEmpty,
  useDiscardEmptyDraft,
} from "../../../../shared/useDiscardEmptyDraft.js";

function sortSlides(slides) {
  return [...(slides || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export const STRAT_PANEL_GAP = 16;
export const STRAT_PANEL_WIDTH = "min(320px, calc(100vw - 3rem))";

export function useStratEditor(stratId) {
  const user = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const kernelRef = useRef(null);
  const stratRef = useRef(null);
  const discardIfEmpty = location.state?.discardIfEmpty === true;
  const discardedRef = useRef(false);
  const shellRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [localSlides, setLocalSlides] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [backgroundUploadError, setBackgroundUploadError] = useState("");
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [pendingCustomBackground, setPendingCustomBackground] = useState(false);
  const overlaySnapshotRef = useRef(null);
  const customPickFileChosenRef = useRef(false);
  const backgroundUploadingRef = useRef(false);
  backgroundUploadingRef.current = backgroundUploading;
  const [panelInsets, setPanelInsets] = useState({
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  });

  const activeSlideId = useEditorStore((s) => s.activeSlideId);
  const setActiveSlideId = useEditorStore((s) => s.setActiveSlideId);
  const dirty = useEditorStore((s) => s.dirty);

  const query = useStratQuery(stratId);
  const mutation = useMutateStrat(stratId);

  const { eventLocked, linkedEvent, canUnlockLinkedEvent } = useLinkedEventLock({
    kind: "strat",
    toolId: stratId,
    enabled: Boolean(stratId),
  });

  const strat = query.data;
  const slides = localSlides || sortSlides(strat?.slides);
  const activeSlide = slides.find((s) => s.id === activeSlideId) || slides[0];

  const canManageToolLockState = canManageToolLock(user.role, strat?.createdBy, user?.steamId);

  const canEdit =
    Boolean(strat) &&
    ["owner", "admin", "editor", "assist"].includes(user.role) &&
    !isToolLocked(strat) &&
    !eventLocked;

  const toggleStratLock = useCallback(
    async (nextLocked) => {
      await mutation.mutateAsync({
        locked: nextLocked,
        lockedBy: nextLocked ? user.steamId : null,
      });
    },
    [mutation, user.steamId]
  );

  useEffect(() => {
    if (!strat) return;
    stratRef.current = strat;
    setLocalSlides(sortSlides(strat.slides));
    const first = sortSlides(strat.slides)[0];
    if (first) setActiveSlideId(first.id);
  }, [strat, setActiveSlideId]);

  useEffect(() => {
    setBackgroundUploadError("");
    setPendingCustomBackground(false);
    overlaySnapshotRef.current = null;
  }, [activeSlide?.id]);

  const disableMapOverlays = useCallback(() => {
    const store = useEditorStore.getState();
    store.setShowGrid(false);
    store.setShowStrongpoints(false);
    store.setShowStrongpointNames(false);
    store.setShowAccessibility(false);
    kernelRef.current?.setOverlays({
      grid: false,
      strongpoints: false,
      strongpointNames: false,
      accessibility: false,
    });
  }, []);

  const restoreMapOverlays = useCallback(() => {
    const snap = overlaySnapshotRef.current;
    const showGrid = snap?.showGrid ?? true;
    const showStrongpoints = snap?.showStrongpoints ?? true;
    const showStrongpointNames = snap?.showStrongpointNames ?? true;
    const showAccessibility = snap?.showAccessibility ?? false;
    const store = useEditorStore.getState();
    store.setShowGrid(showGrid);
    store.setShowStrongpoints(showStrongpoints);
    store.setShowStrongpointNames(showStrongpointNames);
    store.setShowAccessibility(showAccessibility);
    kernelRef.current?.setOverlays({
      grid: showGrid,
      strongpoints: showStrongpoints,
      strongpointNames: showStrongpointNames,
      accessibility: showAccessibility,
    });
    overlaySnapshotRef.current = null;
  }, []);

  useEffect(() => {
    if (activeSlide?.rasterUrl || pendingCustomBackground || backgroundUploading) {
      disableMapOverlays();
      return;
    }
    const { showGrid, showStrongpoints, showStrongpointNames, showAccessibility } =
      useEditorStore.getState();
    kernelRef.current?.setOverlays({
      grid: showGrid,
      strongpoints: showStrongpoints,
      strongpointNames: showStrongpointNames,
      accessibility: showAccessibility,
    });
  }, [
    activeSlide?.id,
    activeSlide?.rasterUrl,
    pendingCustomBackground,
    backgroundUploading,
    disableMapOverlays,
  ]);

  const handleBeginCustomBackgroundPick = useCallback(
    (slideId) => {
      if (!canEdit) return;
      const slide = slides.find((s) => s.id === slideId);
      if (!slide) return;

      customPickFileChosenRef.current = false;

      if (!slide.rasterUrl) {
        const store = useEditorStore.getState();
        overlaySnapshotRef.current = {
          showGrid: store.showGrid,
          showStrongpoints: store.showStrongpoints,
          showStrongpointNames: store.showStrongpointNames,
          showAccessibility: store.showAccessibility,
        };
        disableMapOverlays();
        setPendingCustomBackground(true);
        if (slideId === activeSlide?.id) {
          kernelRef.current?.setStratGroundOnly();
          kernelRef.current?.fitToView();
        }
      } else {
        disableMapOverlays();
      }
    },
    [activeSlide?.id, canEdit, disableMapOverlays, slides]
  );

  const handleCancelCustomBackgroundPick = useCallback(() => {
    if (customPickFileChosenRef.current || backgroundUploadingRef.current) return;
    const slideId = activeSlide?.id;
    if (!slideId) return;
    const slide = sortSlides(stratRef.current?.slides || []).find((s) => s.id === slideId);
    if (slide?.rasterUrl) return;
    setPendingCustomBackground(false);
    if (slide?.mapId) {
      kernelRef.current?.setMap(slide.mapId);
      restoreMapOverlays();
      kernelRef.current?.fitToView();
    }
  }, [activeSlide?.id, restoreMapOverlays]);

  const handleCustomBackgroundFileChosen = useCallback(() => {
    customPickFileChosenRef.current = true;
  }, []);

  const measureInsets = useCallback(() => {
    const shell = shellRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!shell) return;
    const shellRect = shell.getBoundingClientRect();
    const leftRect = left?.getBoundingClientRect();
    const rightRect = right?.getBoundingClientRect();
    setPanelInsets({
      left: leftRect ? Math.max(0, leftRect.right - shellRect.left + STRAT_PANEL_GAP) : 0,
      right: rightRect ? Math.max(0, shellRect.right - rightRect.left + STRAT_PANEL_GAP) : 0,
      top: 0,
      bottom: 0,
    });
  }, []);

  useLayoutEffect(() => {
    measureInsets();
    const ro = new ResizeObserver(() => measureInsets());
    if (shellRef.current) ro.observe(shellRef.current);
    if (leftRef.current) ro.observe(leftRef.current);
    if (rightRef.current) ro.observe(rightRef.current);
    window.addEventListener("resize", measureInsets);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureInsets);
    };
  }, [measureInsets, strat]);

  const getStratSnapshot = useCallback(() => {
    const base = stratRef.current;
    if (!base) return null;
    return { ...base, slides: localSlides || base.slides };
  }, [localSlides]);

  const slideObjects = useMemo(() => activeSlide?.objects || [], [activeSlide]);

  const collabRoomId =
    stratId && activeSlide?.id ? stratSlideRoomId(stratId, activeSlide.id) : null;

  const collab = useYjsRoom({
    roomId: collabRoomId,
    enabled: Boolean(strat && collabRoomId),
    user,
    awarenessState: {
      path: `/strats/${stratId}`,
      context: "stratmaker",
    },
  });

  // Announce on site presence so the dashboard Online Now list includes editors
  useYjsRoom({
    roomId: PRESENCE_ROOM_ID,
    enabled: Boolean(strat && user?.steamId),
    user,
    awarenessState: {
      path: `/strats/${stratId}`,
      context: "stratmaker",
    },
  });

  useKernelYjsBridge({
    doc: collab.doc,
    kernelRef,
    enabled: collab.connected,
    canEdit,
    seedObjects: slideObjects,
  });

  useEffect(() => {
    discardedRef.current = false;
  }, [stratId]);

  const draftEmptyRef = useRef(true);

  useEffect(() => {
    if (!discardIfEmpty) {
      draftEmptyRef.current = true;
      return undefined;
    }
    const tick = () => {
      const currentSlides = localSlides || sortSlides(stratRef.current?.slides);
      draftEmptyRef.current = stratSlidesAreEmpty(currentSlides, {
        activeSlideId: activeSlide?.id,
        kernel: kernelRef.current,
      });
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [discardIfEmpty, dirty, localSlides, activeSlide?.id, slides, slideObjects]);

  useStratAutosave({
    enabled: canEdit && !collab.connected,
    kernelRef,
    getStratSnapshot,
    activeSlideId: activeSlide?.id,
    mutateAsync: mutation.mutateAsync,
  });

  const isDraftEmpty = useCallback(() => {
    const currentSlides = localSlides || sortSlides(stratRef.current?.slides);
    if (kernelRef.current) {
      return stratSlidesAreEmpty(currentSlides, {
        activeSlideId: activeSlide?.id,
        kernel: kernelRef.current,
      });
    }
    return draftEmptyRef.current;
  }, [localSlides, activeSlide?.id]);

  const discardEmptyStrat = useCallback(
    async ({ keepalive = false } = {}) => {
      if (!stratId || discardedRef.current) return;
      discardedRef.current = true;
      await discardDraftRequest(`/strats/${stratId}`, { keepalive });
      queryClient.removeQueries({ queryKey: queryKeys.strats.byId(stratId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.strats.meta });
      queryClient.invalidateQueries({ queryKey: queryKeys.strats.all });
    },
    [stratId, queryClient]
  );

  useDiscardEmptyDraft({
    draftKey: stratId ? `strat:${stratId}` : null,
    enabled: Boolean(
      discardIfEmpty &&
        canEdit &&
        stratId &&
        !linkedEvent &&
        (collab.peers || []).length === 0
    ),
    isEmpty: isDraftEmpty,
    discard: discardEmptyStrat,
  });

  const persistSlides = async (nextSlides) => {
    setLocalSlides(nextSlides);
    stratRef.current = { ...stratRef.current, slides: nextSlides };
    if (!canEdit) return;
    await mutation.mutateAsync({ slides: nextSlides });
  };

  const handleSelectSlide = async (slideId) => {
    if (slideId === activeSlide?.id) return;
    const kernel = kernelRef.current;
    if (kernel && activeSlide && canEdit) {
      const objects = kernel.getObjects();
      const merged = slides.map((s) =>
        s.id === activeSlide.id ? { ...s, objects } : s
      );
      setLocalSlides(merged);
      stratRef.current = { ...stratRef.current, slides: merged };
    }
    setActiveSlideId(slideId);
    setSelected(null);
  };

  const handleAddSlide = async () => {
    const mapId = activeSlide?.mapId || strat?.match?.mapId || getDefaultMapId();
    const next = [
      ...slides,
      {
        id: `slide-${crypto.randomUUID()}`,
        name: `Slide ${slides.length + 1}`,
        order: slides.length,
        mapId,
        objects: [],
      },
    ];
    await persistSlides(next);
    setActiveSlideId(next[next.length - 1].id);
  };

  const handleRemoveSlide = async (slideId) => {
    if (slides.length <= 1) return;
    const next = slides
      .filter((s) => s.id !== slideId)
      .map((s, order) => ({ ...s, order }));
    await persistSlides(next);
    if (activeSlideId === slideId) setActiveSlideId(next[0].id);
  };

  const handleDuplicateSlide = async (slideId) => {
    const source = slides.find((s) => s.id === slideId);
    if (!source) return;
    const next = [
      ...slides,
      {
        ...structuredClone(source),
        id: `slide-${crypto.randomUUID()}`,
        name: `${source.name || "Slide"} copy`,
        order: slides.length,
      },
    ];
    await persistSlides(next);
    setActiveSlideId(next[next.length - 1].id);
  };

  const handleMoveSlide = async (slideId, delta) => {
    const ordered = sortSlides(slides);
    const index = ordered.findIndex((s) => s.id === slideId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    await persistSlides(next.map((s, order) => ({ ...s, order })));
  };

  const handleReorderSlides = async (sourceId, targetId) => {
    if (sourceId === targetId) return;
    const ordered = sortSlides(slides);
    const from = ordered.findIndex((s) => s.id === sourceId);
    const to = ordered.findIndex((s) => s.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    await persistSlides(next.map((s, order) => ({ ...s, order })));
  };

  const handleRenameSlide = async (slideId, name) => {
    await persistSlides(slides.map((s) => (s.id === slideId ? { ...s, name } : s)));
  };

  const handleChangeSlideMap = async (slideId, mapId) => {
    rememberMapId(mapId);
    await persistSlides(
      slides.map((s) =>
        s.id === slideId
          ? {
              ...s,
              mapId,
              rasterUrl: undefined,
              rasterFit: undefined,
              routePlanId: null,
              visibleStrongpoints: undefined,
            }
          : s
      )
    );
  };

  const handleUploadSlideBackground = async (slideId, file) => {
    if (!canEdit || !file) return;
    handleCustomBackgroundFileChosen();
    setBackgroundUploadError("");
    setBackgroundUploading(true);
    disableMapOverlays();
    try {
      const slide = slides.find((s) => s.id === slideId);
      const fit = slide?.rasterFit || STRAT_RASTER_FIT_DEFAULT;
      const { file: prepared, warning } = await prepareImageUpload(file);
      const url = await uploadImageFile(prepared, apiClient);
      await persistSlides(
        slides.map((s) =>
          s.id === slideId
            ? {
                ...s,
                rasterUrl: url,
                rasterFit: fit,
                routePlanId: null,
              }
            : s
        )
      );
      setPendingCustomBackground(false);
      overlaySnapshotRef.current = null;
      if (slideId === activeSlide?.id) {
        kernelRef.current?.setStratCustomBackground(url, { fit });
        kernelRef.current?.fitToView();
      }
      if (warning) {
        setBackgroundUploadError(warning);
      }
    } catch (error) {
      setBackgroundUploadError(error?.message || "Upload failed.");
      const slide = slides.find((s) => s.id === slideId);
      if (!slide?.rasterUrl) {
        setPendingCustomBackground(false);
        if (slide?.mapId) {
          kernelRef.current?.setMap(slide.mapId);
          restoreMapOverlays();
          kernelRef.current?.fitToView();
        }
      }
    } finally {
      setBackgroundUploading(false);
    }
  };

  const handleChangeSlideRasterFit = async (slideId, rasterFit) => {
    await persistSlides(
      slides.map((s) => (s.id === slideId ? { ...s, rasterFit } : s))
    );
    if (slideId === activeSlide?.id) {
      kernelRef.current?.setStratCustomBackgroundFit(rasterFit);
    }
  };

  const handleClearSlideBackground = async (slideId) => {
    const slide = slides.find((s) => s.id === slideId);
    if (!slide?.rasterUrl) return;
    await persistSlides(
      slides.map((s) =>
        s.id === slideId
          ? { ...s, rasterUrl: undefined, rasterFit: undefined, routePlanId: null }
          : s
      )
    );
    if (slideId === activeSlide?.id && slide?.mapId) {
      setPendingCustomBackground(false);
      kernelRef.current?.setMap(slide.mapId);
      restoreMapOverlays();
      kernelRef.current?.fitToView();
    }
    setBackgroundUploadError("");
  };

  const handleChangeSlideVisibleStrongpoints = async (slideId, visibleStrongpoints) => {
    await persistSlides(
      slides.map((s) => (s.id === slideId ? { ...s, visibleStrongpoints } : s))
    );
  };

  const handleChangeSlideRoutePlan = async (slideId, routePlanId) => {
    await persistSlides(
      slides.map((s) =>
        s.id === slideId ? { ...s, routePlanId: routePlanId || undefined } : s
      )
    );
  };

  const handleRenameStrat = async (title) => {
    if (!canEdit) return;
    stratRef.current = { ...stratRef.current, title };
    await mutation.mutateAsync({ title });
  };

  const handlePatchStrat = async (partial) => {
    if (!canEdit) return;
    stratRef.current = { ...stratRef.current, ...partial };
    if (partial.tags) {
      stratRef.current.tags = { ...stratRef.current.tags, ...partial.tags };
    }
    if (partial.match) {
      stratRef.current.match = { ...stratRef.current.match, ...partial.match };
    }
    if (Object.prototype.hasOwnProperty.call(partial, "prepCategory")) {
      stratRef.current.prepCategory = partial.prepCategory || null;
    }
    await mutation.mutateAsync(partial);
  };

  const handleDuplicateStrat = async () => {
    const data = await apiClient(`/strats/${stratId}/duplicate`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const id = data?.strat?.id;
    if (!id) return;
    queryClient.setQueryData(queryKeys.strats.byId(id), data);
    queryClient.invalidateQueries({ queryKey: queryKeys.strats.meta });
    queryClient.invalidateQueries({ queryKey: queryKeys.strats.all });
    navigate(`/strats/${id}`);
  };

  const handleDeleteStrat = async () => {
    if (!window.confirm("Delete this strat? This cannot be undone.")) return;
    discardedRef.current = true;
    await apiClient(`/strats/${stratId}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: queryKeys.strats.meta });
    queryClient.invalidateQueries({ queryKey: queryKeys.strats.all });
    navigate("/home");
  };

  const handleNewStrat = async () => {
    const mapId = getDefaultMapId();
    const slideId = `slide-${crypto.randomUUID()}`;
    const data = await apiClient("/strats", {
      method: "POST",
      body: JSON.stringify({
        strat: {
          title: "Untitled Strat",
          slides: [{ id: slideId, name: "Open", order: 0, mapId, objects: [] }],
          match: { mapId },
        },
      }),
    });
    const id = data?.strat?.id;
    if (!id) return;
    queryClient.setQueryData(queryKeys.strats.byId(id), data);
    queryClient.invalidateQueries({ queryKey: queryKeys.strats.meta });
    queryClient.invalidateQueries({ queryKey: queryKeys.strats.all });
    navigate(`/strats/${id}`, { state: { discardIfEmpty: true } });
  };

  return {
    user,
    query,
    mutation,
    strat,
    slides,
    activeSlide,
    canEdit,
    eventLocked,
    linkedEvent,
    canUnlockLinkedEvent,
    canManageToolLock: canManageToolLockState,
    toolLocked: isToolLocked(strat),
    toggleStratLock,
    dirty,
    selected,
    setSelected,
    showDetails,
    setShowDetails,
    importOpen,
    setImportOpen,
    panelInsets,
    slideObjects,
    kernelRef,
    shellRef,
    leftRef,
    rightRef,
    handleSelectSlide,
    handleAddSlide,
    handleRemoveSlide,
    handleDuplicateSlide,
    handleMoveSlide,
    handleReorderSlides,
    handleRenameSlide,
    handleChangeSlideMap,
    handleUploadSlideBackground,
    handleBeginCustomBackgroundPick,
    handleCancelCustomBackgroundPick,
    handleChangeSlideRasterFit,
    handleClearSlideBackground,
    backgroundUploadError,
    backgroundUploading,
    pendingCustomBackground,
    handleChangeSlideRoutePlan,
    handleChangeSlideVisibleStrongpoints,
    handleRenameStrat,
    handlePatchStrat,
    handleDuplicateStrat,
    handleDeleteStrat,
    handleNewStrat,
    collabPeers: collab.peers,
    collabStatus: collab.status,
  };
}
