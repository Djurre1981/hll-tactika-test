import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "../../../shared/Spinner.jsx";
import { CanvasWrapper } from "./CanvasWrapper.jsx";
import { ToolsPanel } from "./ToolsPanel.jsx";
import { StratsSidePanel } from "./StratsSidePanel.jsx";
import { StratRouteOverlay } from "./StratRouteOverlay.jsx";
import { StratPresentationChrome } from "./StratPresentationChrome.jsx";
import { MapChrome } from "./MapChrome.jsx";
import { CollabPeers } from "../../../shared/CollabPeers.jsx";
import { EditorUserCluster } from "./EditorUserCluster.jsx";
import { ImportStratSketchModal } from "./ImportStratSketchModal.jsx";
import { LinkedEventLockBanner } from "../../events/LinkedEventLockBanner.jsx";
import { STRAT_PANEL_WIDTH, useStratEditor } from "./hooks/useStratEditor.js";
import { useStratPresentation } from "./hooks/useStratPresentation.js";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function StratEditor({ stratId, backTo = "/home" }) {
  const editor = useStratEditor(stratId);
  const [kernelReady, setKernelReady] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const {
    query,
    mutation,
    strat,
    slides,
    activeSlide,
    canEdit,
    eventLocked,
    linkedEvent,
    canUnlockLinkedEvent,
    canManageToolLock,
    toolLocked,
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
    collabPeers,
    collabStatus,
    backgroundUploadError,
    backgroundUploading,
    pendingCustomBackground,
  } = editor;

  const sortedSlides = useMemo(
    () => [...slides].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [slides]
  );
  const activeSlideIndex = Math.max(
    0,
    sortedSlides.findIndex((slide) => slide.id === activeSlide?.id)
  );

  const presentation = useStratPresentation({
    enabled: presenting,
    slideCount: sortedSlides.length,
    activeIndex: activeSlideIndex,
    onSelectIndex: (index) => {
      const slide = sortedSlides[index];
      if (slide) editor.handleSelectSlide(slide.id);
    },
    onExit: () => setPresenting(false),
    shellRef: editor.shellRef,
  });

  const effectiveInsets = presenting
    ? { left: 0, right: 0, top: 0, bottom: 0 }
    : panelInsets;

  const startPresentation = () => {
    setSelected(null);
    kernelRef.current?.clearSelection?.();
    setPresenting(true);
  };

  useEffect(() => {
    if (presenting) {
      const frame = window.requestAnimationFrame(() => {
        kernelRef.current?.fitToView();
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const timer = window.setTimeout(() => {
      kernelRef.current?.fitToView();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [presenting, activeSlide?.id, kernelRef]);

  const hasCustomBackground = Boolean(activeSlide?.rasterUrl);
  const overlaysLocked =
    hasCustomBackground || pendingCustomBackground || backgroundUploading;

  const routePlanId = activeSlide?.routePlanId;
  const routePlanQuery = useQuery({
    queryKey: queryKeys.routePlans.byId(routePlanId),
    queryFn: () =>
      apiClient(`/route-plans/${routePlanId}`).then((d) => {
        const raw = d.plan;
        const inner = raw?.plan && typeof raw.plan === "object" ? raw.plan : {};
        return {
          id: raw.id,
          title: raw.title,
          mapId: raw.mapId ?? inner.mapId,
          factionId: raw.factionId ?? inner.factionId,
          plan: inner,
          routes: inner.routes || [],
        };
      }),
    enabled: Boolean(routePlanId),
    retry: false,
  });

  useEffect(() => {
    setKernelReady(false);
    const t = window.setTimeout(() => setKernelReady(true), 400);
    return () => window.clearTimeout(t);
  }, [activeSlide?.id, activeSlide?.mapId, activeSlide?.rasterUrl]);

  if (query.isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 bg-[#0f0f0f] text-white/50">
        <Spinner /> Loading strat…
      </div>
    );
  }

  if (query.isError || !strat) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0f0f0f] p-6">
        <p className="text-white/50">{query.error?.message || "Strat not found"}</p>
        <Link to={backTo} className="text-white/80 hover:underline">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      className="stratmaker-map-shell relative h-full w-full overflow-hidden"
      onPointerMove={presenting ? presentation.onPointerMove : undefined}
      onPointerLeave={presenting ? presentation.onPointerLeave : undefined}
    >
      {linkedEvent ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[40] p-3">
          <div className="pointer-events-auto mx-auto max-w-xl">
            <LinkedEventLockBanner
              linkedEvent={linkedEvent}
              canUnlockLinkedEvent={canUnlockLinkedEvent}
            />
          </div>
        </div>
      ) : null}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className={`absolute inset-0 ${presenting ? "bg-black" : "bg-[#0f0f0f]"}`} />
        {!presenting ? (
        <>
        <div
          className="absolute inset-0 opacity-100"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' fill='none'%3E%3Cg stroke='rgba(255,235,200,0.1)' stroke-width='0.55' shape-rendering='crispEdges'%3E%3Cpath d='M15 .5H81'/%3E%3Cpath d='M.5 15V81'/%3E%3C/g%3E%3C/svg%3E\")",
            backgroundSize: "96px 96px",
            WebkitMaskImage:
              "linear-gradient(20deg, transparent 0%, rgba(0,0,0,0.15) 18%, #000 44%, #000 56%, rgba(0,0,0,0.15) 82%, transparent 100%)",
            maskImage:
              "linear-gradient(20deg, transparent 0%, rgba(0,0,0,0.15) 18%, #000 44%, #000 56%, rgba(0,0,0,0.15) 82%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(62, 36, 15, 0.76) 0%, rgba(62, 36, 15, 0.28) 24%, transparent 42%)",
          }}
        />
        </>
        ) : null}
      </div>

      <div className="absolute inset-0 z-[1]">
        <CanvasWrapper
          kernelRef={kernelRef}
          mapId={activeSlide?.mapId}
          rasterUrl={activeSlide?.rasterUrl}
          rasterFit={activeSlide?.rasterFit || "contain"}
          customBackgroundPending={pendingCustomBackground}
          slideKey={activeSlide?.id}
          objects={slideObjects}
          locked={!canEdit || presenting}
          panelInsets={effectiveInsets}
          visibleStrongpoints={
            hasCustomBackground ? undefined : activeSlide?.visibleStrongpoints
          }
          onSelectionChange={setSelected}
        />
        {routePlanId && !hasCustomBackground && routePlanQuery.data && (
          <StratRouteOverlay
            kernelRef={kernelRef}
            kernelReady={kernelReady}
            routePlan={routePlanQuery.data}
          />
        )}
      </div>

      {presenting ? (
        <StratPresentationChrome
          stratTitle={strat.title}
          slide={activeSlide}
          slideIndex={activeSlideIndex}
          slideCount={sortedSlides.length}
          notes={strat.notes}
          chromeVisible={presentation.chromeVisible}
          notesOpen={presentation.notesOpen}
          laserOn={presentation.laserOn}
          laserPos={presentation.laserPos}
          canGoPrev={presentation.canGoPrev}
          canGoNext={presentation.canGoNext}
          onPrev={presentation.goPrev}
          onNext={presentation.goNext}
          onToggleNotes={() => presentation.setNotesOpen((open) => !open)}
          onToggleLaser={() => presentation.setLaserOn((on) => !on)}
          onFitView={() => kernelRef.current?.fitToView()}
          onExit={presentation.exitPresentation}
        />
      ) : null}

      {!presenting ? (
      <div
        ref={leftRef}
        className="pointer-events-none absolute bottom-6 left-6 top-6 z-20"
        style={{ width: STRAT_PANEL_WIDTH }}
      >
        <div className="pointer-events-auto h-full">
          <ToolsPanel
            disabled={!canEdit}
            selected={selected}
            onPaste={() => kernelRef.current?.paste()}
            onCopy={() => kernelRef.current?.copy()}
            onDuplicate={() => kernelRef.current?.duplicate()}
            onDeleteSelected={() => {
              kernelRef.current?.deleteSelected();
              setSelected(null);
            }}
            onUndo={() => kernelRef.current?.undo()}
            onRedo={() => kernelRef.current?.redo()}
            onUpdateSelected={(partial) => {
              kernelRef.current?.updateSelected(partial);
              setSelected(kernelRef.current?.getSelected() || null);
            }}
            onSetBezier={(enabled) => {
              kernelRef.current?.setSelectedBezier(enabled);
              setSelected(kernelRef.current?.getSelected() || null);
            }}
          />
        </div>
      </div>
      ) : null}

      {!presenting ? (
      <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
        <MapChrome
          overlaysDisabled={overlaysLocked}
          canEdit={canEdit}
          activeSlide={activeSlide}
          onChangeSlideVisibleStrongpoints={editor.handleChangeSlideVisibleStrongpoints}
          onFitView={() => kernelRef.current?.fitToView()}
        />
      </div>
      ) : null}

      {!presenting ? (
      <div className="absolute right-6 top-6 z-30 flex items-start gap-3">
        <CollabPeers peers={collabPeers} status={collabStatus} />
        <EditorUserCluster />
      </div>
      ) : null}

      {!presenting ? (
      <div
        ref={rightRef}
        className="pointer-events-none absolute bottom-6 right-6 z-20"
        style={{ width: STRAT_PANEL_WIDTH, top: "calc(1.5rem + 2.5rem + 0.65rem)" }}
      >
        <div className="pointer-events-auto h-full">
          <StratsSidePanel
            strat={strat}
            slides={slides}
            activeSlideId={activeSlide?.id}
            dirty={dirty}
            saving={mutation.isPending}
            canEdit={canEdit}
            canManageToolLock={canManageToolLock && !eventLocked}
            toolLocked={toolLocked}
            lockPending={mutation.isPending}
            onToggleToolLock={toggleStratLock}
            showDetails={showDetails}
            onToggleDetails={() => setShowDetails((v) => !v)}
            onSelectSlide={editor.handleSelectSlide}
            onAddSlide={editor.handleAddSlide}
            onRemoveSlide={editor.handleRemoveSlide}
            onDuplicateSlide={editor.handleDuplicateSlide}
            onMoveSlide={editor.handleMoveSlide}
            onReorderSlides={editor.handleReorderSlides}
            onRenameSlide={editor.handleRenameSlide}
            onChangeSlideMap={editor.handleChangeSlideMap}
            onUploadSlideBackground={editor.handleUploadSlideBackground}
            onBeginCustomBackgroundPick={editor.handleBeginCustomBackgroundPick}
            onCancelCustomBackgroundPick={editor.handleCancelCustomBackgroundPick}
            onChangeSlideRasterFit={editor.handleChangeSlideRasterFit}
            onClearSlideBackground={editor.handleClearSlideBackground}
            backgroundUploadError={backgroundUploadError}
            backgroundUploading={backgroundUploading}
            onChangeSlideRoutePlan={editor.handleChangeSlideRoutePlan}
            onRenameStrat={editor.handleRenameStrat}
            onPatchStrat={editor.handlePatchStrat}
            onDuplicateStrat={editor.handleDuplicateStrat}
            onDeleteStrat={editor.handleDeleteStrat}
            onNewStrat={editor.handleNewStrat}
            onImport={() => setImportOpen(true)}
            onPresent={startPresentation}
          />
        </div>
      </div>
      ) : null}

      <ImportStratSketchModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
