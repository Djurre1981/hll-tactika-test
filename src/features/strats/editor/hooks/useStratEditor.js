import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { getDefaultMapId, rememberMapId } from "../mapIds.js";

function sortSlides(slides) {
  return [...(slides || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export const STRAT_PANEL_GAP = 16;
export const STRAT_PANEL_WIDTH = "min(320px, calc(100vw - 3rem))";

export function useStratEditor(stratId) {
  const user = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const kernelRef = useRef(null);
  const stratRef = useRef(null);
  const shellRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [localSlides, setLocalSlides] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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

  const strat = query.data;
  const slides = localSlides || sortSlides(strat?.slides);
  const activeSlide = slides.find((s) => s.id === activeSlideId) || slides[0];

  const canEdit =
    Boolean(strat) &&
    ["owner", "admin", "editor", "assist"].includes(user.role) &&
    (!strat.locked || strat.createdBy === user.steamId || user.role === "owner");

  useEffect(() => {
    if (!strat) return;
    stratRef.current = strat;
    setLocalSlides(sortSlides(strat.slides));
    const first = sortSlides(strat.slides)[0];
    if (first) setActiveSlideId(first.id);
  }, [strat, setActiveSlideId]);

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

  useStratAutosave({
    enabled: canEdit && !collab.connected,
    kernelRef,
    getStratSnapshot,
    activeSlideId: activeSlide?.id,
    mutateAsync: mutation.mutateAsync,
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
    await persistSlides(slides.map((s) => (s.id === slideId ? { ...s, mapId } : s)));
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
    navigate(`/strats/${id}`);
  };

  return {
    user,
    query,
    mutation,
    strat,
    slides,
    activeSlide,
    canEdit,
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
    handleRenameStrat,
    handlePatchStrat,
    handleDuplicateStrat,
    handleDeleteStrat,
    handleNewStrat,
    collabPeers: collab.peers,
    collabStatus: collab.status,
  };
}
