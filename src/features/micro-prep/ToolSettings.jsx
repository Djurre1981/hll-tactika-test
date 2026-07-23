import { Segmented, SizeOption } from "../../shared/toolChrome.jsx";
import { GlassSelect } from "../../shared/GlassSelect.jsx";
import { STRAT_MAP_IDS } from "../strats/editor/mapIds.js";
import {
  BG_COLORS,
  DEFAULT_DRAW_SETTINGS,
  EDGE_STYLES,
  FILL_STYLES,
  FONT_SIZES,
  ROUGHNESS,
  STROKE_COLORS,
  STROKE_STYLES,
  STROKE_WIDTHS,
  actionBtn,
  actionBtnWide,
  cx,
  sectionTitle,
  toolBtnActive,
  toolHasEdges,
  toolHasFill,
  toolHasFont,
  toolHasRoughness,
  toolHasStroke,
  toolHasStrokeStyle,
} from "./whiteboardUi.js";

function ColorRow({ label, colors, value, disabled, allowTransparent, onChange }) {
  const isPreset = colors.some(
    (c) => c.toLowerCase() === String(value || "").toLowerCase()
  );

  return (
    <div className="mb-2">
      <p className={cx(sectionTitle, "mb-1.5")}>{label}</p>
      <div
        className="flex items-center gap-[0.45rem] rounded-[10px] border border-solid border-white/10 bg-black/[0.22] px-[0.55rem] py-[0.45rem]"
        role="group"
        aria-label={label}
      >
        <label
          className={cx(
            "relative block h-[1.65rem] w-[1.65rem] shrink-0 cursor-pointer overflow-hidden rounded-full",
            !isPreset && value !== "transparent" && "shadow-[0_0_0_2px_rgba(255,255,255,0.35)]"
          )}
          title="Custom color"
        >
          <span className="sr-only">Custom color</span>
          <span
            className="block h-full w-full rounded-full border-2 border-white/[0.22]"
            style={{
              background:
                value === "transparent"
                  ? "repeating-conic-gradient(#666 0% 25%, #999 0% 50%) 50% / 8px 8px"
                  : value,
            }}
          />
          <input
            type="color"
            value={value === "transparent" ? "#ffffff" : value || "#ffffff"}
            disabled={disabled}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
        <div className="flex min-w-0 flex-1 flex-wrap gap-[0.3rem]">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled}
              title={c === "transparent" ? "Transparent" : c}
              onClick={() => onChange(c)}
              className={cx(
                "h-[1.15rem] w-[1.15rem] rounded-full border border-white/[0.16] transition hover:scale-105",
                String(value).toLowerCase() === c.toLowerCase() &&
                  "shadow-[0_0_0_2px_rgba(255,255,255,0.38)]"
              )}
              style={{
                background:
                  c === "transparent"
                    ? "repeating-conic-gradient(#666 0% 25%, #999 0% 50%) 50% / 6px 6px"
                    : c,
              }}
            />
          ))}
          {allowTransparent && !colors.includes("transparent") ? null : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Excalidraw-like stroke/fill/style controls for the active tool.
 */
export function ToolSettings({
  tool,
  settings,
  disabled,
  onChange,
  hllMapId,
  onHllMapIdChange,
  hllMapShowGrid = false,
  onHllMapShowGridChange,
  hllMapShowStrongpoints = false,
  onHllMapShowStrongpointsChange,
  onInsertHllMap,
  insertingHllMap = false,
}) {
  if (tool === "hll-map") {
    return (
      <div>
        <h3 className={cx(sectionTitle, "mb-2")}>HLL Map</h3>
        <label className="flex flex-col gap-[0.35rem]">
          <span className={sectionTitle}>Map</span>
          <GlassSelect
            disabled={disabled}
            value={hllMapId || ""}
            onChange={(value) => onHllMapIdChange?.(value)}
            placeholder="Select map…"
            options={STRAT_MAP_IDS.map((id) => ({ value: id, label: id }))}
          />
        </label>
        <div className="mt-2">
          <p className={cx(sectionTitle, "mb-1.5")}>Overlays</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              title="Include tactical grid"
              aria-pressed={hllMapShowGrid}
              disabled={disabled}
              className={cx(
                actionBtn,
                "box-border min-w-0 flex-1 py-2",
                hllMapShowGrid && toolBtnActive
              )}
              onClick={() => onHllMapShowGridChange?.(!hllMapShowGrid)}
            >
              <i className="fa-solid fa-border-all" aria-hidden="true" />
              Grid
            </button>
            <button
              type="button"
              title="Include strongpoints"
              aria-pressed={hllMapShowStrongpoints}
              disabled={disabled}
              className={cx(
                actionBtn,
                "box-border min-w-0 flex-1 py-2",
                hllMapShowStrongpoints && toolBtnActive
              )}
              onClick={() => onHllMapShowStrongpointsChange?.(!hllMapShowStrongpoints)}
            >
              <i className="fa-solid fa-globe" aria-hidden="true" />
              SP
            </button>
          </div>
        </div>
        <button
          type="button"
          className={cx(actionBtnWide, "mt-2")}
          disabled={disabled || !hllMapId || insertingHllMap}
          onClick={() => onInsertHllMap?.()}
        >
          <i className="fa-solid fa-map-location-dot" aria-hidden="true" />
          {insertingHllMap ? "Inserting…" : "Insert map"}
        </button>
        <p className="mt-2 text-[0.65rem] font-light leading-snug text-white/35">
          Grid and strongpoints are baked in before insert. Map stays 1:1 when resized.
        </p>
      </div>
    );
  }

  if (!toolHasStroke(tool)) {
    return (
      <p className="m-0 text-[0.76rem] leading-relaxed text-white/45">
        {tool === "selection"
          ? "Select shapes to move or edit. Use tools above to draw."
          : tool === "eraser"
            ? "Drag to erase elements."
            : tool === "hand"
              ? "Drag to pan the board."
              : null}
      </p>
    );
  }

  const s = { ...DEFAULT_DRAW_SETTINGS, ...settings };

  const patch = (partial) => onChange({ ...s, ...partial });

  return (
    <div>
      <h3 className={cx(sectionTitle, "mb-2")}>
        {tool === "sticky"
          ? "Sticky"
          : tool === "highlighter"
            ? "Highlighter"
            : tool === "freedraw"
              ? "Stroke"
              : tool === "text"
                ? "Text"
                : "Style"}
      </h3>

      <ColorRow
        label="Stroke"
        colors={STROKE_COLORS}
        value={s.strokeColor}
        disabled={disabled}
        onChange={(strokeColor) => patch({ strokeColor })}
      />

      {toolHasFill(tool) ? (
        <>
          <ColorRow
            label="Background"
            colors={BG_COLORS}
            value={s.backgroundColor}
            disabled={disabled}
            allowTransparent
            onChange={(backgroundColor) => patch({ backgroundColor })}
          />
          <div className="mb-[0.55rem] flex flex-wrap items-center justify-between gap-2 text-[0.76rem] text-white/[0.72]">
            <span>Fill</span>
            <Segmented
              disabled={disabled}
              value={s.fillStyle}
              onChange={(fillStyle) => patch({ fillStyle })}
              options={FILL_STYLES}
            />
          </div>
        </>
      ) : null}

      {tool !== "text" ? (
        <div className="mb-[0.55rem] flex flex-wrap items-center justify-between gap-2 text-[0.76rem] text-white/[0.72]">
          <span>Stroke width</span>
          <Segmented
            disabled={disabled}
            value={s.strokeWidth}
            onChange={(strokeWidth) => patch({ strokeWidth })}
            options={STROKE_WIDTHS.map((w) => ({
              value: w.value,
              title: w.label,
              label: w.label,
            }))}
          />
        </div>
      ) : null}

      {toolHasStrokeStyle(tool) ? (
        <div className="mb-[0.55rem] flex flex-wrap items-center justify-between gap-2 text-[0.76rem] text-white/[0.72]">
          <span>Stroke style</span>
          <Segmented
            disabled={disabled}
            value={s.strokeStyle}
            onChange={(strokeStyle) => patch({ strokeStyle })}
            options={STROKE_STYLES}
          />
        </div>
      ) : null}

      {toolHasRoughness(tool) ? (
        <div className="mb-[0.55rem] flex flex-wrap items-center justify-between gap-2 text-[0.76rem] text-white/[0.72]">
          <span>Sloppiness</span>
          <Segmented
            disabled={disabled}
            value={s.roughness}
            onChange={(roughness) => patch({ roughness })}
            options={ROUGHNESS}
          />
        </div>
      ) : null}

      {toolHasEdges(tool) ? (
        <div className="mb-[0.55rem] flex flex-wrap items-center justify-between gap-2 text-[0.76rem] text-white/[0.72]">
          <span>Edges</span>
          <Segmented
            disabled={disabled}
            value={s.roundness}
            onChange={(roundness) => patch({ roundness })}
            options={EDGE_STYLES}
          />
        </div>
      ) : null}

      {toolHasFont(tool) ? (
        <div className="mb-[0.55rem] flex flex-wrap items-center justify-between gap-2 text-[0.76rem] text-white/[0.72]">
          <span>Font size</span>
          <Segmented
            disabled={disabled}
            value={s.fontSize}
            onChange={(fontSize) => patch({ fontSize })}
            options={FONT_SIZES.map((f) => ({
              value: f.value,
              title: f.label,
              label: f.label,
            }))}
          />
        </div>
      ) : null}

      <SizeOption
        label="Opacity"
        value={s.opacity}
        min={10}
        max={100}
        disabled={disabled}
        onChange={(opacity) => patch({ opacity })}
      />
    </div>
  );
}
