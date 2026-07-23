import { cx, glassIconBtn, glassPillBtn } from "./editorUi.js";
import { slideBackgroundLabel } from "./stratBackground.js";

function ChromeBtn({ title, disabled, pressed, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(glassIconBtn, pressed && "border-white/25 bg-white/12 text-white")}
    >
      {children}
    </button>
  );
}

export function StratPresentationChrome({
  stratTitle,
  slide,
  slideIndex,
  slideCount,
  notes,
  chromeVisible,
  notesOpen,
  laserOn,
  laserPos,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onToggleNotes,
  onToggleLaser,
  onFitView,
  onExit,
}) {
  const slideLabel = slide?.name?.trim() || `Slide ${slideIndex + 1}`;
  const mapLabel = slide ? slideBackgroundLabel(slide) : "";
  const speakerNotes = [slideLabel, notes?.trim()].filter(Boolean).join("\n\n");

  return (
    <>
      {laserOn && laserPos ? (
        <div
          className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-1/2"
          style={{ left: laserPos.x, top: laserPos.y }}
          aria-hidden="true"
        >
          <span className="block h-5 w-5 rounded-full border-2 border-white/90 bg-red-500/75 shadow-[0_0_14px_rgba(239,68,68,0.85)]" />
          <span className="absolute left-1/2 top-1/2 block h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </div>
      ) : null}

      <div
        className={cx(
          "pointer-events-none fixed inset-x-0 top-0 z-[55] flex justify-center px-6 pt-5 transition-opacity duration-300",
          chromeVisible ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="pointer-events-auto max-w-3xl rounded-[14px] border border-white/10 bg-black/55 px-4 py-2.5 text-center backdrop-blur-xl">
          <p className="m-0 truncate text-[0.72rem] font-light uppercase tracking-[0.12em] text-white/45">
            {stratTitle || "Untitled strat"}
          </p>
          <p className="m-0 truncate text-[0.95rem] text-white/92">{slideLabel}</p>
          {mapLabel ? (
            <p className="m-0 mt-0.5 truncate text-[0.68rem] text-white/40">{mapLabel}</p>
          ) : null}
        </div>
      </div>

      {notesOpen && speakerNotes ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[5.5rem] z-[55] flex justify-center px-6">
          <div className="pointer-events-auto max-w-2xl rounded-[14px] border border-white/10 bg-black/62 px-4 py-3 backdrop-blur-xl">
            <p className="m-0 mb-1 text-[0.62rem] font-light uppercase tracking-[0.12em] text-white/40">
              Speaker notes
            </p>
            <p className="m-0 whitespace-pre-wrap text-[0.82rem] leading-relaxed text-white/82">
              {speakerNotes}
            </p>
          </div>
        </div>
      ) : null}

      <div
        className={cx(
          "pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center px-4 pb-5 transition-opacity duration-300",
          chromeVisible ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-[14px] border border-white/10 bg-black/58 px-3 py-2 backdrop-blur-xl">
          <ChromeBtn title="Previous slide (←)" disabled={!canGoPrev} onClick={onPrev}>
            <i className="fa-solid fa-chevron-left text-xs" aria-hidden="true" />
          </ChromeBtn>

          <span className="min-w-[4.5rem] px-1 text-center text-[0.78rem] tabular-nums text-white/75">
            {slideIndex + 1} / {slideCount}
          </span>

          <ChromeBtn title="Next slide (→)" disabled={!canGoNext} onClick={onNext}>
            <i className="fa-solid fa-chevron-right text-xs" aria-hidden="true" />
          </ChromeBtn>

          <span className="mx-1 hidden h-5 w-px bg-white/15 sm:block" aria-hidden="true" />

          <ChromeBtn
            title={notesOpen ? "Hide speaker notes" : "Show speaker notes"}
            pressed={notesOpen}
            onClick={onToggleNotes}
          >
            <i className="fa-solid fa-note-sticky text-xs" aria-hidden="true" />
          </ChromeBtn>

          <ChromeBtn
            title={laserOn ? "Hide laser pointer" : "Show laser pointer"}
            pressed={laserOn}
            onClick={onToggleLaser}
          >
            <i className="fa-solid fa-crosshairs text-xs" aria-hidden="true" />
          </ChromeBtn>

          <ChromeBtn title="Fit slide to view" onClick={onFitView}>
            <i className="fa-solid fa-expand text-xs" aria-hidden="true" />
          </ChromeBtn>

          <button
            type="button"
            title="Exit presentation (Esc)"
            onClick={onExit}
            className={cx(glassPillBtn, "ml-1 px-3 py-1.5 text-[0.76rem]")}
          >
            Exit
          </button>
        </div>
      </div>
    </>
  );
}
