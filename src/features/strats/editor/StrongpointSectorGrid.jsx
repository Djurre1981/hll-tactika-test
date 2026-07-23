import { useMemo } from "react";
import {
  availableSectorKeys,
  listSectorCells,
  normalizeVisibleStrongpoints,
} from "../../../shared/strongpointSectors.js";
import { cx, strongpointSectorSelected, strongpointSectorUnselected } from "./editorUi.js";

export function StrongpointSectorGrid({
  grid,
  value,
  disabled = false,
  compact = false,
  onChange,
}) {
  const cells = useMemo(() => listSectorCells(grid), [grid]);
  const available = useMemo(() => availableSectorKeys(grid), [grid]);
  const selected = useMemo(
    () => new Set(normalizeVisibleStrongpoints(value, grid)),
    [value, grid]
  );

  if (!grid || !available.length) {
    return (
      <p className="m-0 text-[0.72rem] leading-relaxed text-white/45">
        No strongpoint layout for this map.
      </p>
    );
  }

  const toggle = (key) => {
    if (disabled || !available.includes(key)) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange?.([...next].sort());
  };

  const enableAll = () => {
    if (disabled) return;
    onChange?.([...available]);
  };

  const disableAll = () => {
    if (disabled) return;
    onChange?.([]);
  };

  return (
    <div>
      <div
        className={cx("grid grid-cols-5", compact ? "gap-[0.22rem]" : "gap-[0.3rem]")}
        role="group"
        aria-label="Visible strongpoints"
      >
        {cells.map(({ row, col, key, available: isAvailable }) => {
          const isSelected = selected.has(key);
          return (
            <button
              key={key}
              type="button"
              disabled={disabled || !isAvailable}
              title={
                isAvailable
                  ? isSelected
                    ? `Hide sector ${key}`
                    : `Show sector ${key}`
                  : "HQ sector"
              }
              aria-pressed={isAvailable ? isSelected : undefined}
              aria-label={
                isAvailable ? `Sector ${row + 1}-${col + 1}` : `HQ ${row + 1}-${col + 1}`
              }
              onClick={() => toggle(key)}
              className={cx(
                "aspect-square border border-solid transition",
                compact ? "rounded-[5px]" : "rounded-[6px]",
                isAvailable
                  ? isSelected
                    ? strongpointSectorSelected
                    : strongpointSectorUnselected
                  : "cursor-default border-white/[0.08] bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.04),rgba(255,255,255,0.04)_4px,rgba(255,255,255,0.12)_4px,rgba(255,255,255,0.12)_8px)]"
              )}
            />
          );
        })}
      </div>
      <div className={cx("flex flex-wrap gap-x-3 gap-y-1", compact ? "mt-1.5 text-[0.68rem]" : "mt-2 text-[0.72rem]")}>
        <button
          type="button"
          disabled={disabled}
          className={cx(
            "border-0 bg-transparent p-0 transition disabled:opacity-35",
            compact
              ? "font-light text-white/45 hover:text-white/70"
              : "text-sky-300/90 hover:text-sky-200"
          )}
          onClick={enableAll}
        >
          Enable all
        </button>
        <button
          type="button"
          disabled={disabled}
          className={cx(
            "border-0 bg-transparent p-0 transition disabled:opacity-35",
            compact
              ? "font-light text-white/45 hover:text-white/70"
              : "text-sky-300/90 hover:text-sky-200"
          )}
          onClick={disableAll}
        >
          Disable all
        </button>
      </div>
    </div>
  );
}
