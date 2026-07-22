import { cx, glassIconBtn, glassIconBtnActive } from "../strats/editor/editorUi.js";

/** Bottom map toolbar — matches Stratmaker MapChrome with route-planner overlays. */
export function RouteMapChrome({
  showGrid,
  onToggleGrid,
  showStrongpoints,
  onToggleStrongpoints,
  showObstacles,
  onToggleObstacles,
  onFitView,
}) {
  return (
    <div
      className="pointer-events-auto flex items-center gap-1.5 rounded-[16px] border border-solid border-white/10 bg-[rgba(24,24,26,0.58)] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-[20px] backdrop-saturate-[180%]"
      role="toolbar"
      aria-label="Map overlays"
    >
      <button type="button" title="Reset view" className={glassIconBtn} onClick={onFitView}>
        <i className="fa-solid fa-house text-sm" aria-hidden="true" />
      </button>
      <button
        type="button"
        title="Toggle grid"
        aria-pressed={showGrid}
        className={cx(glassIconBtn, showGrid && glassIconBtnActive)}
        onClick={onToggleGrid}
      >
        <i className="fa-solid fa-border-all text-sm" aria-hidden="true" />
      </button>
      <button
        type="button"
        title="Toggle strongpoints"
        aria-pressed={showStrongpoints}
        className={cx(glassIconBtn, showStrongpoints && glassIconBtnActive)}
        onClick={onToggleStrongpoints}
      >
        <i className="fa-solid fa-globe text-sm" aria-hidden="true" />
      </button>
      <button
        type="button"
        title={showObstacles ? "Exit obstacles" : "Obstacles"}
        aria-pressed={showObstacles}
        className={cx(
          glassIconBtn,
          showObstacles &&
            "border-red-900/40 bg-[rgba(92,38,38,0.58)] text-red-50 hover:border-red-900/40 hover:bg-[rgba(92,38,38,0.58)]"
        )}
        onClick={onToggleObstacles}
      >
        <i className="fa-solid fa-road-barrier text-sm" aria-hidden="true" />
      </button>
    </div>
  );
}
