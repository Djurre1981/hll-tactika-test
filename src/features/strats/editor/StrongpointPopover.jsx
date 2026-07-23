import { useEffect, useMemo, useRef } from "react";
import {
  getStrongpointGrid,
  isWestEastHqLayout,
  normalizeVisibleStrongpoints,
} from "../../../shared/strongpointSectors.js";
import { StrongpointSectorGrid } from "./StrongpointSectorGrid.jsx";
import { accLabel, cx, mapToolbarGlass } from "./editorUi.js";

function PopoverToggle({ label, checked, disabled, onChange }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-[0.72rem] font-light text-white/70">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-[1.1rem] w-[1.85rem] shrink-0 rounded-full border border-solid transition disabled:cursor-not-allowed disabled:opacity-35",
          checked ? "border-white/20 bg-white/12" : "border-white/10 bg-black/20"
        )}
      >
        <span
          className={cx(
            "absolute top-[0.1rem] h-[0.82rem] w-[0.82rem] rounded-full bg-white/85 shadow-[0_1px_2px_rgba(0,0,0,0.35)] transition",
            checked ? "left-[0.92rem]" : "left-[0.1rem]"
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

export function StrongpointPopover({
  open,
  onClose,
  anchorRef,
  overlaysDisabled = false,
  canEdit = true,
  activeSlide,
  showStrongpoints,
  showStrongpointNames,
  onShowStrongpointsChange,
  onShowStrongpointNamesChange,
  onChangeSlideVisibleStrongpoints,
  mapSpawns,
}) {
  const panelRef = useRef(null);
  const slideMapId = activeSlide?.mapId;
  const grid = useMemo(() => getStrongpointGrid(mapSpawns, slideMapId), [mapSpawns, slideMapId]);
  const visibleKeys = normalizeVisibleStrongpoints(activeSlide?.visibleStrongpoints, grid);
  const layoutHint = grid
    ? isWestEastHqLayout(grid)
      ? "HQs west / east"
      : "HQs north / south"
    : "";

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose?.();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const sectorDisabled = !canEdit || overlaysDisabled || !slideMapId || !showStrongpoints;
  const namesDisabled = !canEdit || overlaysDisabled || !slideMapId || !showStrongpoints;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Strongpoint options"
      className={cx("w-full shrink-0 rounded-[16px] p-2.5", mapToolbarGlass)}
    >
      <div className="flex flex-col gap-2.5">
        <PopoverToggle
          label="Show strongpoints"
          checked={showStrongpoints}
          disabled={overlaysDisabled || !canEdit}
          onChange={onShowStrongpointsChange}
        />
        <PopoverToggle
          label="Show strongpoint names"
          checked={showStrongpointNames}
          disabled={namesDisabled}
          onChange={onShowStrongpointNamesChange}
        />

        <div className="h-px bg-white/[0.08]" aria-hidden="true" />

        <div className="flex flex-col gap-1.5">
          <p className={cx(accLabel, "m-0")}>Visible sectors</p>
          <p className="m-0 text-[0.68rem] font-light leading-relaxed text-white/42">
            {overlaysDisabled
              ? "Unavailable for custom backgrounds."
              : slideMapId
                ? `${slideMapId}${layoutHint ? ` · ${layoutHint}` : ""}`
                : "Select a slide with an HLL map."}
          </p>
          <StrongpointSectorGrid
            compact
            grid={overlaysDisabled ? null : grid}
            value={visibleKeys}
            disabled={sectorDisabled}
            onChange={(keys) => {
              if (!activeSlide?.id) return;
              onChangeSlideVisibleStrongpoints?.(activeSlide.id, keys);
            }}
          />
        </div>
      </div>
    </div>
  );
}
