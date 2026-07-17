import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthGate.jsx";
import { useEditorStore } from "../../../lib/stores/useEditorStore.js";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";
import { Spinner } from "../../../shared/Spinner.jsx";
import { CanvasWrapper } from "./CanvasWrapper.jsx";
import { ToolsPanel } from "./ToolsPanel.jsx";
import { StratsSidePanel } from "./StratsSidePanel.jsx";
import { EditorUserCluster } from "./EditorUserCluster.jsx";
import { ImportStratSketchModal } from "./ImportStratSketchModal.jsx";
import { useMutateStrat } from "./hooks/useMutateStrat.js";
import { useStratAutosave } from "./hooks/useStratAutosave.js";
import { useStratQuery } from "./hooks/useStratQuery.js";
import { getDefaultMapId, rememberMapId } from "./mapIds.js";

function sortSlides(slides) {
  return [...(slides || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

const PANEL_GAP = 16;
const PANEL_WIDTH = "min(320px, calc(100vw - 3rem))";

export function StratEditor({ stratId, backTo = "/home" }) {
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
      left: leftRect ? Math.max(0, leftRect.right - shellRect.left + PANEL_GAP) : 0,
      right: rightRect ? Math.max(0, shellRect.right - rightRect.left + PANEL_GAP) : 0,
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

  useStratAutosave({
    enabled: canEdit,
    kernelRef,
    getStratSnapshot,
    activeSlideId: activeSlide?.id,
    mutateAsync: mutation.mutateAsync,
  });

  const slideObjects = useMemo(() => activeSlide?.objects || [], [activeSlide]);

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

  const handleRenameSlide = async (slideId, name) => {
    const next = slides.map((s) => (s.id === slideId ? { ...s, name } : s));
    await persistSlides(next);
  };

  const handleChangeSlideMap = async (slideId, mapId) => {
    rememberMapId(mapId);
    const next = slides.map((s) => (s.id === slideId ? { ...s, mapId } : s));
    await persistSlides(next);
  };

  const handleRenameStrat = async (title) => {
    if (!canEdit) return;
    stratRef.current = { ...stratRef.current, title };
    await mutation.mutateAsync({ title });
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

  if (query.isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 bg-[#0b0f14] text-white/50">
        <Spinner /> Loading strat…
      </div>
    );
  }

  if (query.isError || !strat) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0b0f14] p-6">
        <p className="text-white/50">{query.error?.message || "Strat not found"}</p>
        <Link to={backTo} className="text-white/80 hover:underline">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div ref={shellRef} className="relative h-full w-full overflow-hidden bg-[#0b0f14]">
      <div className="absolute inset-0">
        <CanvasWrapper
          kernelRef={kernelRef}
          mapId={activeSlide?.mapId}
          slideKey={activeSlide?.id}
          objects={slideObjects}
          locked={!canEdit}
          panelInsets={panelInsets}
          onSelectionChange={setSelected}
        />
      </div>

      <div
        ref={leftRef}
        className="pointer-events-none absolute bottom-6 left-6 top-6 z-20"
        style={{ width: PANEL_WIDTH }}
      >
        <div className="pointer-events-auto h-full">
          <ToolsPanel
            disabled={!canEdit}
            selected={selected}
            onFitView={() => kernelRef.current?.fitToView()}
            onPaste={() => kernelRef.current?.paste()}
            onUndo={() => kernelRef.current?.undo()}
            onRedo={() => kernelRef.current?.redo()}
            onUpdateSelected={(partial) => {
              kernelRef.current?.updateSelected(partial);
              setSelected(kernelRef.current?.getSelected() || null);
            }}
          />
        </div>
      </div>

      <div className="absolute right-6 top-6 z-30">
        <EditorUserCluster />
      </div>

      <div
        ref={rightRef}
        className="pointer-events-none absolute bottom-6 right-6 z-20"
        style={{ width: PANEL_WIDTH, top: "calc(1.5rem + 2.5rem + 0.65rem)" }}
      >
        <div className="pointer-events-auto h-full">
          <StratsSidePanel
            strat={strat}
            slides={slides}
            activeSlideId={activeSlide?.id}
            dirty={dirty}
            saving={mutation.isPending}
            canEdit={canEdit}
            showDetails={showDetails}
            onToggleDetails={() => setShowDetails((v) => !v)}
            onSelectSlide={handleSelectSlide}
            onAddSlide={handleAddSlide}
            onRemoveSlide={handleRemoveSlide}
            onRenameSlide={handleRenameSlide}
            onChangeSlideMap={handleChangeSlideMap}
            onRenameStrat={handleRenameStrat}
            onNewStrat={handleNewStrat}
            onImport={() => setImportOpen(true)}
          />
        </div>
      </div>

      <ImportStratSketchModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
