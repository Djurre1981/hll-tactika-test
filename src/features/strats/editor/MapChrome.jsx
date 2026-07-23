import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../../lib/stores/useEditorStore.js";
import { useToolStore } from "../../../lib/stores/useToolStore.js";
import { loadMapSpawns } from "../../../shared/strongpointSectors.js";
import { StrongpointPopover } from "./StrongpointPopover.jsx";
import { cx, glassIconBtn, glassIconBtnActive, mapToolbarGlass, mapToolbarWidth } from "./editorUi.js";

/** Map chrome: fit / grid / accessibility / strongpoints / HLL spawn radius. */
export function MapChrome({
  onFitView,
  overlaysDisabled = false,
  canEdit = true,
  activeSlide,
  onChangeSlideVisibleStrongpoints,
}) {
  const showGrid = useEditorStore((s) => s.showGrid);
  const showStrongpoints = useEditorStore((s) => s.showStrongpoints);
  const showStrongpointNames = useEditorStore((s) => s.showStrongpointNames);
  const showAccessibility = useEditorStore((s) => s.showAccessibility);
  const setShowGrid = useEditorStore((s) => s.setShowGrid);
  const setShowStrongpoints = useEditorStore((s) => s.setShowStrongpoints);
  const setShowStrongpointNames = useEditorStore((s) => s.setShowStrongpointNames);
  const setShowAccessibility = useEditorStore((s) => s.setShowAccessibility);
  const hllShowRadius = useToolStore((s) => s.hllShowRadius);
  const patch = useToolStore((s) => s.patch);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [mapSpawns, setMapSpawns] = useState(null);
  const chromeRef = useRef(null);

  useEffect(() => {
    loadMapSpawns().then(setMapSpawns);
  }, []);

  useEffect(() => {
    setPopoverOpen(false);
  }, [activeSlide?.id, overlaysDisabled]);

  const overlayOff = (label) =>
    overlaysDisabled ? `${label} unavailable for custom backgrounds` : `Toggle ${label}`;

  return (
    <div ref={chromeRef} className={cx("pointer-events-auto flex flex-col items-stretch gap-1.5", mapToolbarWidth)}>
      <StrongpointPopover
        open={popoverOpen && !overlaysDisabled}
        onClose={() => setPopoverOpen(false)}
        anchorRef={chromeRef}
        overlaysDisabled={overlaysDisabled}
        canEdit={canEdit}
        activeSlide={activeSlide}
        mapSpawns={mapSpawns}
        showStrongpoints={showStrongpoints}
        showStrongpointNames={showStrongpointNames}
        onShowStrongpointsChange={setShowStrongpoints}
        onShowStrongpointNamesChange={setShowStrongpointNames}
        onChangeSlideVisibleStrongpoints={onChangeSlideVisibleStrongpoints}
      />

      <div
        className={cx(
          "flex shrink-0 flex-nowrap items-center justify-center gap-1.5 rounded-[16px] p-1.5",
          mapToolbarGlass
        )}
        role="toolbar"
        aria-label="Map overlays"
      >
        <button type="button" title="Reset view" className={glassIconBtn} onClick={onFitView}>
          <i className="fa-solid fa-house text-sm" aria-hidden="true" />
        </button>
        <button
          type="button"
          title={overlayOff("grid")}
          aria-pressed={showGrid}
          disabled={overlaysDisabled}
          className={cx(glassIconBtn, showGrid && glassIconBtnActive, overlaysDisabled && "opacity-35")}
          onClick={() => setShowGrid(!showGrid)}
        >
          <i className="fa-solid fa-border-all text-sm" aria-hidden="true" />
        </button>
        <button
          type="button"
          title={overlayOff("accessibility")}
          aria-pressed={showAccessibility}
          disabled={overlaysDisabled}
          className={cx(
            glassIconBtn,
            showAccessibility && glassIconBtnActive,
            overlaysDisabled && "opacity-35"
          )}
          onClick={() => setShowAccessibility(!showAccessibility)}
        >
          <i className="fa-solid fa-wheelchair text-sm" aria-hidden="true" />
        </button>
        <button
          type="button"
          title={
            overlaysDisabled
              ? "Strongpoints unavailable for custom backgrounds"
              : "Strongpoint options"
          }
          aria-expanded={popoverOpen}
          aria-haspopup="dialog"
          disabled={overlaysDisabled}
          className={cx(
            glassIconBtn,
            "relative",
            (showStrongpoints || popoverOpen) && glassIconBtnActive,
            overlaysDisabled && "opacity-35"
          )}
          onClick={() => setPopoverOpen((open) => !open)}
        >
          <i
            className={cx(
              "fa-solid fa-chevron-up pointer-events-none absolute left-1/2 top-0 block origin-bottom -translate-x-1/2 -translate-y-full text-[0.34rem] leading-none text-white/30 transition-transform duration-200",
              popoverOpen && "rotate-180 text-white/45"
            )}
            aria-hidden="true"
          />
          <i className="fa-solid fa-globe text-sm" aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Show spawn radius"
          aria-pressed={hllShowRadius}
          className={cx(glassIconBtn, hllShowRadius && glassIconBtnActive)}
          onClick={() => patch({ hllShowRadius: !hllShowRadius })}
        >
          <i className="fa-solid fa-circle-dot text-sm" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
