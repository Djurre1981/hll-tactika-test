import { Link } from "react-router-dom";
import { Spinner } from "../../../shared/Spinner.jsx";
import { CanvasWrapper } from "./CanvasWrapper.jsx";
import { ToolsPanel } from "./ToolsPanel.jsx";
import { StratsSidePanel } from "./StratsSidePanel.jsx";
import { MapChrome } from "./MapChrome.jsx";
import { EditorUserCluster } from "./EditorUserCluster.jsx";
import { ImportStratSketchModal } from "./ImportStratSketchModal.jsx";
import { STRAT_PANEL_WIDTH, useStratEditor } from "./hooks/useStratEditor.js";

export function StratEditor({ stratId, backTo = "/home" }) {
  const editor = useStratEditor(stratId);
  const {
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
  } = editor;

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
    <div ref={shellRef} className="stratmaker-map-shell relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[#0f0f0f]" />
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
      </div>

      <div className="absolute inset-0 z-[1]">
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
          />
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
        <MapChrome onFitView={() => kernelRef.current?.fitToView()} />
      </div>

      <div className="absolute right-6 top-6 z-30">
        <EditorUserCluster />
      </div>

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
            onRenameStrat={editor.handleRenameStrat}
            onPatchStrat={editor.handlePatchStrat}
            onDuplicateStrat={editor.handleDuplicateStrat}
            onDeleteStrat={editor.handleDeleteStrat}
            onNewStrat={editor.handleNewStrat}
            onImport={() => setImportOpen(true)}
          />
        </div>
      </div>

      <ImportStratSketchModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
