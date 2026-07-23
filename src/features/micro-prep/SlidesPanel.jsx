import {
  cx,
  glassBtn,
  panelBody,
  panelDivider,
  panelGlassFill,
  panelShell,
  sectionTitle,
  stratPickerTrigger,
} from "../strats/editor/editorUi.js";
import { IconBtn } from "../strats/editor/sidePanelUtils.jsx";
import { MicroPrepDetailsPanel } from "./MicroPrepDetailsPanel.jsx";
import { sortSlides } from "./slidesUtils.js";

/**
 * Right-side panel for Micro-Prep slideshow mode: title, options, slides list.
 */
export function SlidesPanel({
  whiteboardId,
  title = "",
  slideCount = 0,
  saving = false,
  slides = [],
  activeSlideId,
  showDetails = false,
  onToggleDetails,
  onTitleChange,
  onSelect,
  onAdd,
  onRemove,
  onRename,
  disabled = false,
  canEdit = false,
  canManageToolLock = false,
  toolLocked = false,
  lockPending = false,
  onToggleToolLock,
}) {
  const sorted = sortSlides(slides);
  const metaBits = [
    `${slideCount} slide${slideCount === 1 ? "" : "s"}`,
    saving ? "Saving…" : "Saved",
  ];

  return (
    <aside className={`${panelShell} h-full`} aria-label="Slides panel">
      <div className={panelGlassFill} aria-hidden="true" />
      <div className={panelBody}>
        <section className="shrink-0">
          <div className="flex items-stretch gap-[0.45rem]">
            <div className={stratPickerTrigger}>
              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={title}
                  disabled={!canEdit}
                  onChange={(e) => onTitleChange?.(e.target.value)}
                  className="w-full truncate bg-transparent text-[0.82rem] font-normal text-white outline-none placeholder:text-white/40"
                  placeholder="Slideshow title"
                  aria-label="Slideshow title"
                />
                <p className="mt-[0.1rem] truncate text-[0.64rem] font-light uppercase tracking-[0.06em] text-white/45">
                  {metaBits.join(" · ")}
                </p>
              </div>
            </div>
            <IconBtn title="Board options" pressed={showDetails} onClick={onToggleDetails}>
              <i className="fa-solid fa-circle-info" aria-hidden="true" />
            </IconBtn>
          </div>
        </section>

        <div className={panelDivider} role="presentation" />

        {showDetails ? (
          <MicroPrepDetailsPanel
            whiteboardId={whiteboardId}
            canEdit={canEdit}
            canManageToolLock={canManageToolLock}
            toolLocked={toolLocked}
            lockPending={lockPending}
            onToggleToolLock={onToggleToolLock}
            onBack={onToggleDetails}
          />
        ) : (
          <>
            <header className="flex shrink-0 items-center justify-between gap-2">
              <h2 className={sectionTitle}>Slides</h2>
              <button
                type="button"
                disabled={disabled}
                className={glassBtn}
                onClick={onAdd}
              >
                + Add
              </button>
            </header>
            <div className={panelDivider} role="presentation" />
            <ul className="m-0 min-h-0 flex-1 list-none space-y-1.5 overflow-y-auto p-0">
              {sorted.map((slide, index) => {
                const active = slide.id === activeSlideId;
                return (
                  <li key={slide.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onSelect(slide.id)}
                      className={`w-full rounded-[10px] border border-solid px-3 py-2.5 text-left transition ${
                        active
                          ? "border-white/25 bg-white/12 text-white"
                          : "border-white/10 bg-transparent text-white/70 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <span className="block text-[0.78rem] font-light tracking-[0.02em]">
                        {slide.name || `Slide ${index + 1}`}
                      </span>
                      <span className="mt-0.5 block text-[0.65rem] text-white/35">
                        Slide {index + 1}
                      </span>
                    </button>
                    {active && !disabled ? (
                      <div className="mt-1.5 flex gap-1.5 px-0.5">
                        <button
                          type="button"
                          className={`${glassBtn} !px-2 !py-1 text-[0.65rem]`}
                          onClick={() => {
                            const name = window.prompt(
                              "Slide name",
                              slide.name || `Slide ${index + 1}`
                            );
                            if (name != null) onRename?.(slide.id, name.trim().slice(0, 80));
                          }}
                        >
                          Rename
                        </button>
                        {sorted.length > 1 ? (
                          <button
                            type="button"
                            className={cx(glassBtn, "!px-2 !py-1 text-[0.65rem] text-red-300/90")}
                            onClick={() => onRemove?.(slide.id)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}
