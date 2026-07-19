import { Link } from "react-router-dom";
import { useToolStore } from "../../../lib/stores/useToolStore.js";
import {
  COLOR_PRESETS,
  TOOL_ITEMS,
  actionBtn,
  cx,
  getHllObjectDef,
  panelBody,
  panelDivider,
  panelGlassFill,
  panelShell,
  sectionTitle,
} from "./editorUi.js";
import { ToolBtn } from "./ToolsPanelPrimitives.jsx";
import { ToolsPanelOptions } from "./ToolsPanelOptions.jsx";

function selectionLabel(selected) {
  if (!selected) return "";
  if (selected.type === "hll") {
    return getHllObjectDef(selected.meta?.hllId)?.label || "HLL object";
  }
  if (selected.type === "icon") {
    return selected.meta?.iconId || "icon";
  }
  if (selected.type === "text") {
    const text = String(selected.meta?.text || "Text").trim();
    return text.length > 18 ? `${text.slice(0, 18)}…` : text || "Text";
  }
  return selected.type;
}

export function ToolsPanel({
  disabled = false,
  onPaste,
  onUndo,
  onRedo,
  onCopy,
  onDuplicate,
  onDeleteSelected,
  selected,
  onUpdateSelected,
}) {
  const tool = useToolStore((s) => s.tool);
  const color = useToolStore((s) => s.color);
  const strokeWidth = useToolStore((s) => s.strokeWidth);
  const lineType = useToolStore((s) => s.lineType);
  const endType = useToolStore((s) => s.endType);
  const filled = useToolStore((s) => s.filled);
  const fontSize = useToolStore((s) => s.fontSize);
  const textStyle = useToolStore((s) => s.textStyle);
  const textAlign = useToolStore((s) => s.textAlign);
  const iconId = useToolStore((s) => s.iconId);
  const iconLabel = useToolStore((s) => s.iconLabel);
  const hllId = useToolStore((s) => s.hllId);
  const hllRadiusCheck = useToolStore((s) => s.hllRadiusCheck);
  const patch = useToolStore((s) => s.patch);

  const isStroke = tool === "pen" || tool === "line" || tool === "curve";
  const isShape = tool === "rect" || tool === "ellipse";
  const isPreset = COLOR_PRESETS.some((c) => c.toLowerCase() === color.toLowerCase());
  const selectedColor = selected?.style?.color || color;

  const setTool = (id) => {
    // Legacy: if something still requests the removed arrow tool, use Line with an end head.
    if (id === "arrow") {
      patch({ tool: "line", endType: endType === "none" ? "end" : endType });
      return;
    }
    patch({ tool: id });
  };

  const applyColor = (next) => {
    patch({ color: next });
    if (selected) onUpdateSelected?.({ style: { color: next } });
  };

  return (
    <aside className={panelShell} aria-label="Drawing tools">
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
        </div>

        <section className="pt-3">
          <h2 className={cx(sectionTitle, "mb-2")}>Tools</h2>

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
                style={{ background: color }}
              />
              <input
                type="color"
                value={color}
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
                    color.toLowerCase() === c.toLowerCase() &&
                      "shadow-[0_0_0_2px_rgba(255,255,255,0.38)]"
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-[0.45rem]" role="toolbar" aria-label="Drawing tools">
            {TOOL_ITEMS.map((item) => (
              <ToolBtn
                key={item.id}
                title={item.title}
                icon={item.icon}
                iconSrc={item.iconSrc}
                disabled={disabled}
                active={tool === item.id}
                onClick={() => setTool(item.id)}
              />
            ))}
          </div>

          {selected ? (
            <div
              className="mt-2 flex items-center gap-1.5 rounded-[10px] border border-solid border-white/10 bg-black/[0.28] px-[0.5rem] py-[0.4rem]"
              role="status"
              aria-label="Selected object"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
                style={{ background: selectedColor }}
                title={selectedColor}
              />
              <span className="min-w-0 flex-1 truncate text-[0.68rem] text-white/[0.78]">
                <span className="text-white/90">{selectionLabel(selected)}</span>
                <span className="text-white/35"> · </span>
                <span className="font-mono text-[0.62rem] uppercase tracking-wide text-white/45">
                  {selected.type}
                </span>
              </span>
              <div className="flex shrink-0 gap-0.5" role="group" aria-label="Selection actions">
                <button
                  type="button"
                  className={actionBtn}
                  title="Copy (Ctrl+C)"
                  disabled={disabled}
                  onClick={onCopy}
                >
                  <i className="fa-solid fa-copy" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={actionBtn}
                  title="Duplicate (Ctrl+D)"
                  disabled={disabled}
                  onClick={onDuplicate}
                >
                  <i className="fa-solid fa-clone" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={cx(actionBtn, "hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200")}
                  title="Delete"
                  disabled={disabled}
                  onClick={onDeleteSelected}
                >
                  <i className="fa-solid fa-trash" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <ToolsPanelOptions
          tool={tool}
          disabled={disabled}
          selected={selected}
          isStroke={isStroke}
          isShape={isShape}
          strokeWidth={strokeWidth}
          lineType={lineType}
          endType={endType}
          filled={filled}
          fontSize={fontSize}
          textStyle={textStyle}
          textAlign={textAlign}
          iconId={iconId}
          iconLabel={iconLabel}
          hllId={hllId}
          hllRadiusCheck={hllRadiusCheck}
          patch={patch}
          onPaste={onPaste}
          onUpdateSelected={onUpdateSelected}
          onUndo={onUndo}
          onRedo={onRedo}
        />
      </div>
    </aside>
  );
}
