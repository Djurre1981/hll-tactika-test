import { useEffect, useState } from "react";
import { STRAT_MAP_IDS } from "./mapIds.js";

const panelClass =
  "relative flex h-full flex-col overflow-hidden rounded-[16px] border border-white/[0.14] shadow-[0_24px_80px_rgba(0,0,0,0.28)]";

function IconBtn({ title, disabled, onClick, children, pressed }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border text-sm transition ${
        pressed
          ? "border-white/[0.22] bg-white/[0.12] text-white"
          : "border-white/12 bg-white/[0.05] text-white/[0.88] hover:bg-white/10"
      } disabled:cursor-not-allowed disabled:opacity-35`}
    >
      {children}
    </button>
  );
}

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
  onRenameSlide,
  onChangeSlideMap,
  onRenameStrat,
  onNewStrat,
  onImport,
}) {
  const sorted = [...slides].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const active = sorted.find((s) => s.id === activeSlideId) || sorted[0];
  const [titleDraft, setTitleDraft] = useState(strat?.title || "");
  const [slideNameDraft, setSlideNameDraft] = useState(active?.name || "");

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
    <aside className={panelClass} aria-label="Strategy panel">
      <div
        className="pointer-events-none absolute inset-0 rounded-[16px] bg-[rgba(24,24,26,0.58)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-[20px] backdrop-saturate-[180%]"
        aria-hidden="true"
      />

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 rounded-[10px] border border-white/12 bg-[rgba(50,50,50,0.55)] px-3 py-2">
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
              className="w-full truncate bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/40"
              placeholder="Select or create a strat…"
            />
            <p className="mt-0.5 truncate text-[0.68rem] uppercase tracking-wide text-white/40">
              {metaBits.join(" · ") || (dirty || saving ? "Saving…" : "Saved")}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <IconBtn
              title="Strat details"
              pressed={showDetails}
              onClick={onToggleDetails}
            >
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
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-[10px] border border-white/10 bg-black/[0.22] p-3">
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
              Details
            </h2>
            <p className="text-xs text-white/50">
              Status: {dirty || saving ? "Saving…" : "Saved"}
              {strat?.locked ? " · Locked" : ""}
            </p>
            <p className="text-xs text-white/40">
              Created by {strat?.createdByName || "unknown"}
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2">
              <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
                Slides
              </h2>
              <span className="text-[0.68rem] text-white/35">{sorted.length}</span>
              <button
                type="button"
                disabled={!canEdit}
                title="Add slide"
                onClick={onAddSlide}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/12 bg-white/[0.05] text-white/80 hover:bg-white/10 disabled:opacity-35"
              >
                <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              </button>
            </header>

            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {sorted.map((slide, index) => {
                const isActive = slide.id === active?.id;
                return (
                  <li key={slide.id}>
                    <button
                      type="button"
                      onClick={() => onSelectSlide(slide.id)}
                      className={`w-full rounded-[10px] border px-3 py-2.5 text-left transition ${
                        isActive
                          ? "border-white/[0.22] bg-white/[0.12] text-white"
                          : "border-transparent text-white/65 hover:border-white/10 hover:bg-white/5"
                      }`}
                    >
                      <div className="truncate text-sm font-medium">
                        {slide.name || `Slide ${index + 1}`}
                      </div>
                      <div className="mt-0.5 truncate text-[0.68rem] text-white/40">
                        {slide.mapId}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {active && (
              <div className="space-y-2 rounded-[10px] border border-white/10 bg-black/[0.22] p-3">
                <h3 className="text-xs font-medium text-white/70">Active slide</h3>
                <label className="block text-[0.7rem] text-white/45">
                  Name
                  <input
                    type="text"
                    maxLength={40}
                    disabled={!canEdit}
                    value={slideNameDraft}
                    onChange={(e) => setSlideNameDraft(e.target.value)}
                    onBlur={() => {
                      if (slideNameDraft !== (active.name || "")) {
                        onRenameSlide?.(active.id, slideNameDraft);
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus:border-white/25"
                  />
                </label>
                <label className="block text-[0.7rem] text-white/45">
                  Map
                  <select
                    disabled={!canEdit}
                    value={active.mapId || ""}
                    onChange={(e) => onChangeSlideMap?.(active.id, e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus:border-white/25"
                  >
                    {STRAT_MAP_IDS.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </label>
                {sorted.length > 1 && canEdit && (
                  <button
                    type="button"
                    onClick={() => onRemoveSlide?.(active.id)}
                    className="w-full rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-1.5 text-[0.7rem] text-red-300 hover:bg-red-500/20"
                  >
                    Delete slide
                  </button>
                )}
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
