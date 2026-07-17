import { useEditorStore } from "../../../lib/stores/useEditorStore.js";
import { cx, glassIconBtn, glassIconBtnActive } from "./editorUi.js";

/** Map chrome: fit / grid / strongpoints (kept out of the legacy tool grid). */
export function MapChrome({ onFitView }) {
  const showGrid = useEditorStore((s) => s.showGrid);
  const showStrongpoints = useEditorStore((s) => s.showStrongpoints);
  const setShowGrid = useEditorStore((s) => s.setShowGrid);
  const setShowStrongpoints = useEditorStore((s) => s.setShowStrongpoints);

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
        onClick={() => setShowGrid(!showGrid)}
      >
        <i className="fa-solid fa-border-all text-sm" aria-hidden="true" />
      </button>
      <button
        type="button"
        title="Toggle strongpoints"
        aria-pressed={showStrongpoints}
        className={cx(glassIconBtn, showStrongpoints && glassIconBtnActive)}
        onClick={() => setShowStrongpoints(!showStrongpoints)}
      >
        <i className="fa-solid fa-globe text-sm" aria-hidden="true" />
      </button>
    </div>
  );
}
