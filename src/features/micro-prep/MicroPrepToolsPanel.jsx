import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { normalizeLineCaps } from "@map-kernel/line-caps.js";
import { useToolStore } from "../../lib/stores/useToolStore.js";
import { COLOR_PRESETS } from "../strats/editor/editorUi.js";
import {
  actionBtn,
  actionBtnWide,
  cx,
  glassInput,
  glassSelect,
  MICRO_PREP_TOOL_ITEMS,
  panelBody,
  panelDivider,
  panelGlassFill,
  panelShell,
  sectionTitle,
  toolBtnActive,
} from "./whiteboardUi.js";
import { getDefaultMapId, STRAT_MAP_IDS } from "../strats/editor/mapIds.js";
import { ToolBtn } from "../strats/editor/ToolsPanelPrimitives.jsx";
import { ToolsPanelOptions } from "../strats/editor/ToolsPanelOptions.jsx";
import { LineToolIcon } from "../strats/editor/LineToolIcon.jsx";

const STROKE_TYPES = new Set(["pen", "line", "curve", "arrow"]);
const LINE_STROKE_TYPES = new Set(["line", "curve", "arrow"]);
const SHAPE_TYPES = new Set(["rect", "ellipse"]);

const DEFAULT_TOOL_STATE = {
  tool: "select",
  color: "#ffffff",
  strokeWidth: 3,
  lineType: "solid",
  endType: "none",
  startCap: "none",
  endCap: "none",
  opacity: 100,
  startSize: 5,
  endSize: 6,
  lineBezier: false,
  filled: true,
  fontSize: 14,
  textStyle: 0,
  textAlign: "center",
  fontFamily: "Inter",
  bold: false,
  italic: false,
  underline: false,
  textVAlign: "middle",
  outlineColor: "none",
  outlineWidth: 0,
  shadow: "none",
  padding: 2,
  rotation: 0,
  eyedropTarget: null,
};

function selectionLabel(selected) {
  if (!selected) return "";
  if (selected.type === "text") {
    const text = String(selected.meta?.text || "Text").trim();
    return text.length > 18 ? `${text.slice(0, 18)}…` : text || "Text";
  }
  return selected.type;
}

export function MicroPrepToolsPanel({
  disabled = false,
  kernelRef,
  title,
  onTitleChange,
  theme = "dark",
  onThemeChange,
  onBackgroundUpload,
  uploading = false,
  hasPageImage = false,
  onClearPageImage,
  onInsertHllMap,
  selected,
  onSelectionChange,
}) {
  const fileRef = useRef(null);
  const [panelTool, setPanelTool] = useState("select");
  const [hllMapId, setHllMapId] = useState(() => getDefaultMapId());
  const [hllMapShowGrid, setHllMapShowGrid] = useState(false);
  const [hllMapShowStrongpoints, setHllMapShowStrongpoints] = useState(false);
  const [insertingHllMap, setInsertingHllMap] = useState(false);

  const tool = useToolStore((s) => s.tool);
  const color = useToolStore((s) => s.color);
  const strokeWidth = useToolStore((s) => s.strokeWidth);
  const lineType = useToolStore((s) => s.lineType);
  const endType = useToolStore((s) => s.endType);
  const startCap = useToolStore((s) => s.startCap);
  const endCap = useToolStore((s) => s.endCap);
  const opacity = useToolStore((s) => s.opacity);
  const startSize = useToolStore((s) => s.startSize);
  const endSize = useToolStore((s) => s.endSize);
  const lineBezier = useToolStore((s) => s.lineBezier);
  const filled = useToolStore((s) => s.filled);
  const fontSize = useToolStore((s) => s.fontSize);
  const textStyle = useToolStore((s) => s.textStyle);
  const textAlign = useToolStore((s) => s.textAlign);
  const fontFamily = useToolStore((s) => s.fontFamily);
  const bold = useToolStore((s) => s.bold);
  const italic = useToolStore((s) => s.italic);
  const underline = useToolStore((s) => s.underline);
  const textVAlign = useToolStore((s) => s.textVAlign);
  const outlineColor = useToolStore((s) => s.outlineColor);
  const outlineWidth = useToolStore((s) => s.outlineWidth);
  const shadow = useToolStore((s) => s.shadow);
  const padding = useToolStore((s) => s.padding);
  const eyedropTarget = useToolStore((s) => s.eyedropTarget);
  const iconId = useToolStore((s) => s.iconId);
  const iconLabel = useToolStore((s) => s.iconLabel);
  const hllId = useToolStore((s) => s.hllId);
  const hllRadiusCheck = useToolStore((s) => s.hllRadiusCheck);
  const patch = useToolStore((s) => s.patch);

  useEffect(() => {
    useToolStore.setState({
      ...DEFAULT_TOOL_STATE,
      color: theme === "light" ? "#1e1e1e" : "#ffffff",
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- reset on mount only

  const selectedIsStroke = Boolean(selected && STROKE_TYPES.has(selected.type));
  const selectedIsLineStroke = Boolean(selected && LINE_STROKE_TYPES.has(selected.type));
  const selectedIsShape = Boolean(selected && SHAPE_TYPES.has(selected.type));
  const selectedIsText = selected?.type === "text";
  const hideColorStrip = tool === "text" || selectedIsText;
  const showLineStroke =
    selectedIsLineStroke ||
    ((tool === "line" || tool === "curve") && !selectedIsStroke);
  const showStroke =
    (tool === "pen" || (selectedIsStroke && !selectedIsLineStroke)) && !showLineStroke;
  const showShape = tool === "rect" || tool === "ellipse" || selectedIsShape;

  const activeColor = selected?.style?.color || color;
  const textStyleObj = selectedIsText ? selected.style || {} : null;
  const activeOpacity = selectedIsText
    ? Number.isFinite(Number(textStyleObj?.opacity))
      ? Number(textStyleObj.opacity)
      : opacity
    : selectedIsLineStroke
      ? Number.isFinite(Number(selected.style?.opacity))
        ? Number(selected.style.opacity)
        : opacity
      : opacity;
  const activeStrokeWidth = selectedIsStroke
    ? Number(selected.style?.size) || strokeWidth
    : strokeWidth;
  const activeLineType = selectedIsStroke
    ? selected.style?.lineType || lineType
    : lineType;
  const selectionCaps = selectedIsLineStroke
    ? normalizeLineCaps(selected.style || {})
    : null;
  const activeStartCap = selectionCaps?.startCap || startCap;
  const activeEndCap = selectionCaps?.endCap || endCap;
  const activeEndType = selectedIsLineStroke
    ? selected.style?.endType || endType
    : endType;
  const activeStartSize = selectedIsLineStroke
    ? Number(selected.style?.startSize) || startSize
    : startSize;
  const activeEndSize = selectedIsLineStroke
    ? Number(selected.style?.endSize) || endSize
    : endSize;
  const activeBezier = selectedIsLineStroke
    ? selected.type === "curve"
    : tool === "curve"
      ? true
      : lineBezier;
  const activeFilled = selectedIsShape ? Boolean(selected.style?.filled) : filled;
  const activeFontSize = selectedIsText
    ? Number(textStyleObj?.fontSize) || fontSize
    : fontSize;
  const activeTextStyle = selectedIsText
    ? Number(textStyleObj?.textStyle) || textStyle
    : textStyle;
  const activeTextAlign = selectedIsText
    ? textStyleObj?.textAlign || textAlign
    : textAlign;
  const activeFontFamily = selectedIsText
    ? textStyleObj?.fontFamily || fontFamily
    : fontFamily;
  const activeBold = selectedIsText ? Boolean(textStyleObj?.bold) : bold;
  const activeItalic = selectedIsText ? Boolean(textStyleObj?.italic) : italic;
  const activeUnderline = selectedIsText ? Boolean(textStyleObj?.underline) : underline;
  const activeTextVAlign = selectedIsText
    ? textStyleObj?.textVAlign || textVAlign
    : textVAlign;
  const activeOutlineColor = selectedIsText
    ? textStyleObj?.outlineColor || outlineColor
    : outlineColor;
  const activeOutlineWidth = selectedIsText
    ? Number.isFinite(Number(textStyleObj?.outlineWidth))
      ? Number(textStyleObj.outlineWidth)
      : outlineWidth
    : outlineWidth;
  const activeShadow = selectedIsText ? textStyleObj?.shadow || shadow : shadow;
  const activePadding = selectedIsText
    ? Number.isFinite(Number(textStyleObj?.padding))
      ? Number(textStyleObj.padding)
      : padding
    : padding;

  const isPreset = COLOR_PRESETS.some((c) => c.toLowerCase() === activeColor.toLowerCase());
  const lineToolActive = tool === "line" || tool === "curve";
  const isDark = theme === "dark";

  useEffect(() => {
    if (!selected?.style) return;
    const style = selected.style;
    const next = {};
    if (style.color) next.color = style.color;
    if (STROKE_TYPES.has(selected.type) || SHAPE_TYPES.has(selected.type)) {
      if (Number.isFinite(Number(style.size))) next.strokeWidth = Number(style.size);
      if (style.lineType) next.lineType = style.lineType;
    }
    if (LINE_STROKE_TYPES.has(selected.type)) {
      const caps = normalizeLineCaps(style);
      next.startCap = caps.startCap;
      next.endCap = caps.endCap;
      if (style.endType) next.endType = style.endType;
      if (Number.isFinite(Number(style.opacity))) next.opacity = Number(style.opacity);
      if (Number.isFinite(Number(style.startSize))) next.startSize = Number(style.startSize);
      if (Number.isFinite(Number(style.endSize))) next.endSize = Number(style.endSize);
      next.lineBezier = selected.type === "curve";
    }
    if (SHAPE_TYPES.has(selected.type)) next.filled = Boolean(style.filled);
    if (selected.type === "text") {
      if (Number.isFinite(Number(style.fontSize))) next.fontSize = Number(style.fontSize);
      if (Number.isFinite(Number(style.textStyle))) next.textStyle = Number(style.textStyle);
      if (style.textAlign) next.textAlign = style.textAlign;
      if (style.fontFamily) next.fontFamily = style.fontFamily;
      if (style.bold != null) next.bold = Boolean(style.bold);
      if (style.italic != null) next.italic = Boolean(style.italic);
      if (style.underline != null) next.underline = Boolean(style.underline);
      if (style.textVAlign) next.textVAlign = style.textVAlign;
      if (style.outlineColor != null) next.outlineColor = style.outlineColor;
      if (Number.isFinite(Number(style.outlineWidth))) next.outlineWidth = Number(style.outlineWidth);
      if (style.shadow) next.shadow = style.shadow;
      if (Number.isFinite(Number(style.padding))) next.padding = Number(style.padding);
      if (Number.isFinite(Number(style.opacity))) next.opacity = Number(style.opacity);
    }
    if (Object.keys(next).length) patch(next);
  }, [selected?.id, selected?.type, selected?.style, patch]);

  const selectPanelTool = (id) => {
    setPanelTool(id);
    if (id === "hll-map") return;
    if (id === "highlighter") {
      patch({ tool: "pen", color: "#facc15", opacity: 40, strokeWidth: 4 });
      return;
    }
    if (id === "sticky") {
      patch({ tool: "rect", color: "#fef08a", filled: true, strokeWidth: 2 });
      return;
    }
    if (id === "line") {
      patch({ tool: "line", lineBezier: false });
      return;
    }
    patch({ tool: id === "select" ? "select" : id });
  };

  const applyStyle = (stylePartial, storePartial = {}) => {
    patch(storePartial);
    if (selected) {
      kernelRef.current?.updateSelected({ style: stylePartial });
      onSelectionChange?.(kernelRef.current?.getSelected() || null);
    }
  };

  const applyColor = (next) => {
    applyStyle({ color: next }, { color: next });
  };

  const handleSetBezier = (checked) => {
    if (selectedIsLineStroke) {
      kernelRef.current?.setSelectedBezier(checked);
      onSelectionChange?.(kernelRef.current?.getSelected() || null);
      patch({ lineBezier: checked });
      return;
    }
    patch({ lineBezier: checked });
  };

  const handleEyedrop = (target) => {
    patch({ eyedropTarget: target });
  };

  useEffect(() => {
    if (!eyedropTarget) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") patch({ eyedropTarget: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [eyedropTarget, patch]);

  const handleThemeChange = (next) => {
    patch({
      color: next === "light" ? "#1e1e1e" : "#ffffff",
    });
    onThemeChange?.(next);
  };

  const handleInsertHllMap = async () => {
    if (disabled || !hllMapId || insertingHllMap) return;
    setInsertingHllMap(true);
    try {
      await onInsertHllMap?.(hllMapId, {
        showGrid: hllMapShowGrid,
        showStrongpoints: hllMapShowStrongpoints,
      });
      setPanelTool("select");
      patch({ tool: "select" });
    } catch (err) {
      console.error("[micro-prep] insert HLL map failed:", err);
    } finally {
      setInsertingHllMap(false);
    }
  };

  const toolActive = (item) => {
    if (item.id === "line") return lineToolActive;
    if (item.id === "highlighter") return panelTool === "highlighter" && tool === "pen";
    if (item.id === "sticky") return panelTool === "sticky" && tool === "rect";
    if (item.id === "hll-map") return panelTool === "hll-map";
    if (item.id === "select") return tool === "select" && panelTool !== "hll-map";
    return tool === item.id;
  };

  return (
    <aside
      className={cx(panelShell, eyedropTarget && "cursor-crosshair")}
      aria-label="Micro-prep tools"
    >
      <div className={panelGlassFill} aria-hidden="true" />

      <div className={cx(panelBody, "overflow-y-auto")}>
        <div className="shrink-0">
          <Link
            to="/home"
            aria-label="Back to dashboard"
            className="mb-5 block w-fit max-w-[14rem] opacity-[0.92] transition hover:opacity-80"
          >
            <img
              src="/assets/logos/tactika-full-logo.svg"
              alt="Hell Let Loose Tactika"
              className="h-12 w-auto max-w-full object-contain object-left"
            />
          </Link>
          <div className={panelDivider} role="presentation" />
          <div className="flex items-center justify-between gap-2 pt-3">
            <p className={sectionTitle}>Micro Prep</p>
            <button
              type="button"
              className={actionBtn}
              title={isDark ? "Switch to white mode" : "Switch to black mode"}
              aria-pressed={!isDark}
              disabled={disabled}
              onClick={() => handleThemeChange(isDark ? "light" : "dark")}
            >
              <i
                className={isDark ? "fa-regular fa-sun" : "fa-regular fa-moon"}
                aria-hidden="true"
              />
              <span>{isDark ? "White" : "Black"}</span>
            </button>
          </div>
        </div>

        <div className={panelDivider} />

        <label className="block shrink-0">
          <span className={sectionTitle}>Title</span>
          <input
            type="text"
            value={title}
            disabled={disabled}
            onChange={(e) => onTitleChange?.(e.target.value)}
            className={cx(glassInput, "mt-2")}
            placeholder="Board title"
          />
        </label>

        <div className={panelDivider} />

        <section className="pt-1">
          <h2 className={cx(sectionTitle, "mb-2")}>Tools</h2>

          {!hideColorStrip ? (
            <div
              className="mb-3 flex items-center gap-[0.45rem] rounded-[10px] border border-solid border-white/10 bg-black/[0.22] px-[0.55rem] py-[0.45rem]"
              role="group"
              aria-label="Stroke color"
            >
              <label
                className={cx(
                  "relative block h-[1.65rem] w-[1.65rem] shrink-0 cursor-pointer overflow-hidden rounded-full",
                  !isPreset && "shadow-[0_0_0_2px_rgba(255,255,255,0.35)]"
                )}
                title="Pick any color"
              >
                <span className="sr-only">Pick any color</span>
                <span
                  className="block h-full w-full rounded-full border-2 border-white/[0.22] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]"
                  style={{ background: activeColor }}
                />
                <input
                  type="color"
                  value={activeColor}
                  disabled={disabled}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => applyColor(e.target.value)}
                />
              </label>
              <div className="flex min-w-0 flex-1 flex-wrap gap-[0.3rem]">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={disabled}
                    title={c}
                    onClick={() => applyColor(c)}
                    className={cx(
                      "h-[1.15rem] w-[1.15rem] rounded-full border border-white/[0.16] transition hover:scale-105",
                      activeColor.toLowerCase() === c.toLowerCase() &&
                        "shadow-[0_0_0_2px_rgba(255,255,255,0.38)]"
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          ) : eyedropTarget ? (
            <p className="mb-3 m-0 rounded-[10px] border border-amber-300/25 bg-amber-500/10 px-2 py-1.5 text-[0.68rem] text-amber-100/90">
              Click the page to pick a {eyedropTarget} color. Esc cancels.
            </p>
          ) : null}

          <div className="grid grid-cols-4 gap-1.5" role="toolbar" aria-label="Drawing tools">
            {MICRO_PREP_TOOL_ITEMS.map((item) => (
              <ToolBtn
                key={item.id}
                title={item.title}
                icon={item.icon}
                iconNode={item.id === "line" ? <LineToolIcon /> : undefined}
                disabled={disabled}
                active={toolActive(item)}
                onClick={() => selectPanelTool(item.id)}
              />
            ))}
          </div>

          {selected || tool === "select" ? (
            <div
              className="mt-2 flex items-center gap-1.5 rounded-[10px] border border-solid border-white/10 bg-black/[0.28] px-[0.5rem] py-[0.4rem]"
              role="status"
            >
              {selected ? (
                <>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
                    style={{ background: activeColor }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[0.68rem] text-white/[0.78]">
                    <span className="text-white/90">{selectionLabel(selected)}</span>
                    <span className="text-white/35"> · </span>
                    <span className="font-mono text-[0.62rem] uppercase tracking-wide text-white/45">
                      {selected.type}
                    </span>
                  </span>
                </>
              ) : (
                <span className="min-w-0 flex-1 truncate text-[0.68rem] text-white/40">
                  Clipboard
                </span>
              )}
              <div className="flex shrink-0 gap-0.5" role="group" aria-label="Selection actions">
                <button
                  type="button"
                  className={actionBtn}
                  title="Paste (Ctrl+V)"
                  disabled={disabled}
                  onClick={() => kernelRef.current?.paste()}
                >
                  <i className="fa-solid fa-paste" aria-hidden="true" />
                </button>
                {selected ? (
                  <>
                    <button
                      type="button"
                      className={actionBtn}
                      title="Copy (Ctrl+C)"
                      disabled={disabled}
                      onClick={() => kernelRef.current?.copy()}
                    >
                      <i className="fa-solid fa-copy" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={actionBtn}
                      title="Duplicate (Ctrl+D)"
                      disabled={disabled}
                      onClick={() => kernelRef.current?.duplicate()}
                    >
                      <i className="fa-solid fa-clone" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={cx(
                        actionBtn,
                        "hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200"
                      )}
                      title="Delete"
                      disabled={disabled}
                      onClick={() => {
                        kernelRef.current?.deleteSelected();
                        onSelectionChange?.(null);
                      }}
                    >
                      <i className="fa-solid fa-trash" aria-hidden="true" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {panelTool === "hll-map" ? (
          <>
            <div className={panelDivider} />
            <section>
              <h3 className={sectionTitle}>HLL Map</h3>
              <select
                value={hllMapId}
                disabled={disabled}
                onChange={(e) => setHllMapId(e.target.value)}
                className={cx(glassSelect, "mt-2 w-full")}
              >
                {STRAT_MAP_IDS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={hllMapShowGrid}
                  title="Grid overlay"
                  className={cx(actionBtn, hllMapShowGrid && toolBtnActive)}
                  onClick={() => setHllMapShowGrid((v) => !v)}
                >
                  Grid
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={hllMapShowStrongpoints}
                  title="Strongpoints overlay"
                  className={cx(actionBtn, hllMapShowStrongpoints && toolBtnActive)}
                  onClick={() => setHllMapShowStrongpoints((v) => !v)}
                >
                  SP
                </button>
              </div>
              <button
                type="button"
                className={cx(actionBtnWide, "mt-2")}
                disabled={disabled || !hllMapId || insertingHllMap}
                onClick={handleInsertHllMap}
              >
                <i className="fa-solid fa-map-location-dot" aria-hidden="true" />
                {insertingHllMap ? "Inserting…" : "Set map page"}
              </button>
            </section>
          </>
        ) : null}

        <ToolsPanelOptions
          tool={tool}
          disabled={disabled}
          selected={selected}
          isStroke={showStroke}
          isLineStroke={showLineStroke}
          isShape={showShape}
          editingSelection={Boolean(
            selected && (selectedIsStroke || selectedIsShape || selectedIsText)
          )}
          strokeWidth={activeStrokeWidth}
          lineType={activeLineType}
          endType={activeEndType}
          startCap={activeStartCap}
          endCap={activeEndCap}
          opacity={activeOpacity}
          startSize={activeStartSize}
          endSize={activeEndSize}
          lineBezier={activeBezier}
          filled={activeFilled}
          fontSize={activeFontSize}
          textStyle={activeTextStyle}
          textAlign={activeTextAlign}
          fontFamily={activeFontFamily}
          bold={activeBold}
          italic={activeItalic}
          underline={activeUnderline}
          textVAlign={activeTextVAlign}
          outlineColor={activeOutlineColor}
          outlineWidth={activeOutlineWidth}
          shadow={activeShadow}
          padding={activePadding}
          color={activeColor}
          iconId={iconId}
          iconLabel={iconLabel}
          hllId={hllId}
          hllRadiusCheck={hllRadiusCheck}
          patch={patch}
          onUpdateSelected={(partial) => {
            kernelRef.current?.updateSelected(partial);
            onSelectionChange?.(kernelRef.current?.getSelected() || null);
          }}
          onApplyStyle={applyStyle}
          onSetBezier={handleSetBezier}
          onEyedrop={handleEyedrop}
          onUndo={() => kernelRef.current?.undo()}
          onRedo={() => kernelRef.current?.redo()}
        />

        <div className={panelDivider} />

        <div>
          <p className={sectionTitle}>Page background</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onBackgroundUpload?.(file);
            }}
          />
          <button
            type="button"
            className={cx(actionBtnWide, "mt-2")}
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
          >
            <i className="fa-solid fa-panorama" aria-hidden="true" />
            {uploading ? "Uploading…" : "Upload page image"}
          </button>
          {hasPageImage ? (
            <button
              type="button"
              className={cx(actionBtnWide, "mt-1.5")}
              disabled={disabled}
              onClick={() => onClearPageImage?.()}
            >
              Reset to blank page
            </button>
          ) : null}
          <p className="mt-2 text-[0.65rem] font-light leading-snug text-white/35">
            Background becomes the kernel page. Use HLL Map to insert a tactical map.
          </p>
        </div>
      </div>
    </aside>
  );
}
