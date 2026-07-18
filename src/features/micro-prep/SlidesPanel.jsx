import {
  glassBtn,
  panelBody,
  panelDivider,
  panelGlassFill,
  panelShell,
  sectionTitle,
} from "../../shared/glassUi.js";
import { sortSlides } from "./slidesUtils.js";

/**
 * Right-side slides list for Micro-Prep slideshow mode.
 */
export function SlidesPanel({
  slides = [],
  activeSlideId,
  onSelect,
  onAdd,
  onRemove,
  onRename,
  disabled = false,
}) {
  const sorted = sortSlides(slides);

  return (
    <div className={`${panelShell} h-full`}>
      <div className={panelGlassFill} aria-hidden="true" />
      <div className={panelBody}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={sectionTitle}>Slides</h2>
          <button
            type="button"
            disabled={disabled}
            className={glassBtn}
            onClick={onAdd}
          >
            + Add
          </button>
        </div>
        <div className={panelDivider} />
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
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
                        className={`${glassBtn} !px-2 !py-1 text-[0.65rem] text-red-300/90`}
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
      </div>
    </div>
  );
}
