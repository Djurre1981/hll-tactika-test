import { useEffect, useState } from "react";
import { STRAT_MAP_IDS } from "./mapIds.js";
import { StratDetailsPanel } from "./StratDetailsPanel.jsx";
import { SlideRoutePlanPicker } from "./SlideRoutePlanPicker.jsx";
import {
  cx,
  fieldLabel,
  glassIconBtn,
  glassInput,
  glassSelect,
  panelBody,
  panelGlassFill,
  panelShell,
  sectionTitle,
  slideAction,
  slideActionLg,
  slideItem,
  slideItemActive,
  slideItemDragging,
  slideItemDropTarget,
  stratPickerTrigger,
} from "./editorUi.js";
import { IconBtn, mapThumbUrl } from "./sidePanelUtils.jsx";

export function StratsSidePanel({
  strat,
  slides = [],
  activeSlideId,
  dirty,
  saving,
  canEdit,
  showDetails,
  onToggleDetails,
  onSelectSlide,
  onAddSlide,
  onRemoveSlide,
  onDuplicateSlide,
  onMoveSlide,
  onReorderSlides,
  onRenameSlide,
  onChangeSlideMap,
  onChangeSlideRoutePlan,
  onRenameStrat,
  onPatchStrat,
  onDuplicateStrat,
  onDeleteStrat,
  onNewStrat,
  onImport,
}) {
  const sorted = [...slides].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const active = sorted.find((s) => s.id === activeSlideId) || sorted[0];
  const [titleDraft, setTitleDraft] = useState(strat?.title || "");
  const [slideNameDraft, setSlideNameDraft] = useState(active?.name || "");
  const [dragId, setDragId] = useState(null);
  const [dropId, setDropId] = useState(null);

  useEffect(() => {
    setTitleDraft(strat?.title || "");
  }, [strat?.title, strat?.id]);

  useEffect(() => {
    setSlideNameDraft(active?.name || "");
  }, [active?.id, active?.name]);

  const metaBits = [
    strat?.tags?.team,
    strat?.tags?.type,
    `${sorted.length} slide${sorted.length === 1 ? "" : "s"}`,
  ].filter(Boolean);

  return (
    <aside className={panelShell} aria-label="Strategy panel">
      <div className={panelGlassFill} aria-hidden="true" />

      <div className={panelBody}>
        <div className="flex items-stretch gap-[0.45rem]">
          <div className={stratPickerTrigger}>
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={titleDraft}
                disabled={!canEdit}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  if (titleDraft.trim() && titleDraft !== strat?.title) {
                    onRenameStrat?.(titleDraft.trim());
                  }
                }}
                className="w-full truncate bg-transparent text-[0.82rem] font-normal text-white outline-none placeholder:text-white/40"
                placeholder="Select or create a strat…"
              />
              <p className="mt-[0.1rem] truncate text-[0.64rem] font-light uppercase tracking-[0.06em] text-white/45">
                {metaBits.join(" · ") || (dirty || saving ? "Saving…" : "Saved")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-stretch gap-[0.45rem]">
            <IconBtn title="Strat details" pressed={showDetails} onClick={onToggleDetails}>
              <i className="fa-solid fa-circle-info" aria-hidden="true" />
            </IconBtn>
            <IconBtn title="New strat" disabled={!canEdit} onClick={onNewStrat}>
              <i className="fa-solid fa-plus" aria-hidden="true" />
            </IconBtn>
            <IconBtn title="Import from StratSketch" disabled={!canEdit} onClick={onImport}>
              <i className="fa-solid fa-file-import" aria-hidden="true" />
            </IconBtn>
          </div>
        </div>

        {showDetails ? (
          <StratDetailsPanel
            strat={strat}
            canEdit={canEdit}
            onBack={onToggleDetails}
            onPatchStrat={onPatchStrat}
            onDuplicateStrat={onDuplicateStrat}
            onDeleteStrat={onDeleteStrat}
          />
        ) : (
          <>
            <header className="flex shrink-0 items-center gap-2">
              <h2 className={cx(sectionTitle, "flex-1")}>Slides</h2>
              <span className="text-[0.64rem] uppercase tracking-[0.1em] text-white/35">
                {sorted.length}
              </span>
              <button
                type="button"
                disabled={!canEdit}
                title="Add slide"
                aria-label="Add slide"
                onClick={onAddSlide}
                className={cx(glassIconBtn, "ml-auto")}
              >
                <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              </button>
            </header>

            <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-[0.45rem] overflow-y-auto p-0">
              {sorted.length === 0 && (
                <li className="px-2 py-4 text-center text-[0.78rem] text-white/45">
                  No slides yet — add one to begin.
                </li>
              )}
              {sorted.map((slide, index) => {
                const isActive = slide.id === active?.id;
                const isFirst = index === 0;
                const isLast = index === sorted.length - 1;
                const thumb = mapThumbUrl(slide.mapId);
                return (
                  <li key={slide.id}>
                    <div
                      draggable={canEdit}
                      className={cx(
                        slideItem,
                        isActive && slideItemActive,
                        dragId === slide.id && slideItemDragging,
                        dropId === slide.id && dragId !== slide.id && slideItemDropTarget
                      )}
                      onClick={() => onSelectSlide(slide.id)}
                      onDragStart={(e) => {
                        if (!canEdit) return;
                        setDragId(slide.id);
                        e.dataTransfer.setData("text/plain", slide.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDropId(null);
                      }}
                      onDragOver={(e) => {
                        if (!canEdit || !dragId || dragId === slide.id) return;
                        e.preventDefault();
                        setDropId(slide.id);
                      }}
                      onDragLeave={() => {
                        if (dropId === slide.id) setDropId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const sourceId = e.dataTransfer.getData("text/plain") || dragId;
                        setDropId(null);
                        setDragId(null);
                        if (sourceId && sourceId !== slide.id) {
                          onReorderSlides?.(sourceId, slide.id);
                        }
                      }}
                    >
                      <div className="flex shrink-0 flex-col items-center gap-[0.1rem]">
                        <button
                          type="button"
                          title="Drag to reorder"
                          aria-label="Drag to reorder"
                          className={cx(slideAction, "cursor-grab active:cursor-grabbing")}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <i className="fa-solid fa-grip-vertical" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title="Move up"
                          aria-label="Move slide up"
                          disabled={!canEdit || isFirst}
                          className={slideAction}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveSlide?.(slide.id, -1);
                          }}
                        >
                          <i className="fa-solid fa-chevron-up" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title="Move down"
                          aria-label="Move slide down"
                          disabled={!canEdit || isLast}
                          className={slideAction}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveSlide?.(slide.id, 1);
                          }}
                        >
                          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
                        </button>
                      </div>

                      <div
                        className="h-[2.1rem] w-[2.1rem] shrink-0 overflow-hidden rounded-[0.35rem] border border-white/[0.08] bg-white/[0.06]"
                        aria-hidden="true"
                      >
                        {thumb ? (
                          <img src={thumb} alt="" className="h-full w-full object-cover opacity-80" />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="truncate font-normal text-white/85">
                          {slide.name || `Slide ${index + 1}`}
                        </div>
                        <div className="truncate text-[0.68rem] text-white/40">{slide.mapId}</div>
                      </div>

                      {canEdit && (
                        <div className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            title="Duplicate slide"
                            aria-label="Duplicate slide"
                            className={slideActionLg}
                            onClick={() => onDuplicateSlide?.(slide.id)}
                          >
                            <i className="fa-regular fa-copy text-xs" aria-hidden="true" />
                          </button>
                          {sorted.length > 1 && (
                            <button
                              type="button"
                              title="Delete slide"
                              aria-label="Delete slide"
                              className={slideActionLg}
                              onClick={() => onRemoveSlide?.(slide.id)}
                            >
                              <i className="fa-regular fa-trash-can text-xs" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {active && (
              <div className="mt-3 flex shrink-0 flex-col gap-[0.55rem] border-t border-solid border-white/[0.08] pt-3">
                <h3 className={sectionTitle}>Active slide</h3>
                <label className={fieldLabel}>
                  Name
                  <input
                    type="text"
                    maxLength={40}
                    disabled={!canEdit}
                    value={slideNameDraft}
                    placeholder="Untitled"
                    onChange={(e) => setSlideNameDraft(e.target.value)}
                    onBlur={() => {
                      if (slideNameDraft !== (active.name || "")) {
                        onRenameSlide?.(active.id, slideNameDraft);
                      }
                    }}
                    className={cx(glassInput, "mt-1")}
                  />
                </label>
                <label className={fieldLabel}>
                  Map
                  <span className="relative mt-1 block">
                    <select
                      disabled={!canEdit}
                      value={active.mapId || ""}
                      onChange={(e) => onChangeSlideMap?.(active.id, e.target.value)}
                      className={glassSelect}
                    >
                      {STRAT_MAP_IDS.map((id) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                    <i
                      className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[0.65rem] text-white/50 fa-solid fa-chevron-down"
                      aria-hidden="true"
                    />
                  </span>
                </label>
                <SlideRoutePlanPicker
                  slide={active}
                  strat={strat}
                  canEdit={canEdit}
                  onChangeRoutePlan={onChangeSlideRoutePlan}
                />
                <p className="text-center text-[0.68rem] text-white/35">
                  {dirty || saving ? "Saving…" : "Saved!"}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
