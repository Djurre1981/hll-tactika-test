import { useToolStore } from "../../../lib/stores/useToolStore.js";
import { useEditorStore } from "../../../lib/stores/useEditorStore.js";

const COLORS = [
  "#ffffff",
  "#c0c0c0",
  "#ff4444",
  "#22d3ee",
  "#3b82f6",
  "#ffcc00",
  "#ff8800",
  "#c084fc",
  "#111111",
];

const TOOL_ROW_1 = [
  { id: "select", icon: "fa-solid fa-arrow-pointer", title: "Select" },
  { id: "pen", icon: "fa-solid fa-pen", title: "Draw" },
  { id: "line", icon: "fa-solid fa-minus", title: "Line" },
  { id: "ellipse", icon: "fa-regular fa-circle", title: "Circle" },
  { id: "rect", icon: "fa-regular fa-square", title: "Rectangle" },
];

const TOOL_ROW_2 = [
  { id: "fit", icon: "fa-solid fa-house", title: "Reset view", action: "fit" },
  { id: "text", icon: "fa-solid fa-font", title: "Text" },
  { id: "arrow", icon: "fa-solid fa-arrow-right-long", title: "Arrow" },
  { id: "grid", icon: "fa-solid fa-border-all", title: "Toggle grid", action: "grid" },
  { id: "strongpoints", icon: "fa-solid fa-globe", title: "Toggle strongpoints", action: "strongpoints" },
];

const panelClass =
  "relative flex h-full flex-col overflow-hidden rounded-[16px] border border-white/[0.14] shadow-[0_24px_80px_rgba(0,0,0,0.28)]";

function ToolBtn({ active, disabled, title, icon, onClick }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={`flex aspect-square items-center justify-center rounded-[10px] border text-[0.9rem] transition ${
        active
          ? "border-white/[0.22] bg-white/[0.12] text-white"
          : "border-white/10 bg-black/[0.28] text-white/[0.72] hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white"
      } disabled:cursor-not-allowed disabled:opacity-35`}
    >
      <i className={icon} aria-hidden="true" />
    </button>
  );
}

export function ToolsPanel({
  disabled = false,
  onFitView,
  onPaste,
  onUndo,
  onRedo,
  selected,
  onUpdateSelected,
}) {
  const tool = useToolStore((s) => s.tool);
  const color = useToolStore((s) => s.color);
  const strokeWidth = useToolStore((s) => s.strokeWidth);
  const filled = useToolStore((s) => s.filled);
  const patch = useToolStore((s) => s.patch);
  const showGrid = useEditorStore((s) => s.showGrid);
  const showStrongpoints = useEditorStore((s) => s.showStrongpoints);
  const setShowGrid = useEditorStore((s) => s.setShowGrid);
  const setShowStrongpoints = useEditorStore((s) => s.setShowStrongpoints);

  const handleToolClick = (item) => {
    if (item.action === "fit") {
      onFitView?.();
      return;
    }
    if (item.action === "grid") {
      setShowGrid(!showGrid);
      return;
    }
    if (item.action === "strongpoints") {
      setShowStrongpoints(!showStrongpoints);
      return;
    }
    patch({ tool: item.id });
  };

  return (
    <aside className={panelClass} aria-label="Drawing tools">
      <div
        className="pointer-events-none absolute inset-0 rounded-[16px] bg-[rgba(24,24,26,0.58)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-[20px] backdrop-saturate-[180%]"
        aria-hidden="true"
      />

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <img
          src="/assets/logos/tactika-full-logo.svg"
          alt="Hell Let Loose Tactika"
          className="mb-1 h-12 w-auto max-w-full object-contain object-left"
        />

        <section>
          <h2 className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white/45">
            Tools
          </h2>
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[10px] border border-white/10 bg-black/[0.22] px-2.5 py-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={disabled}
                title={c}
                onClick={() => patch({ color: c })}
                className={`h-[1.65rem] w-[1.65rem] rounded-full border-2 ${
                  color === c ? "border-white" : "border-white/20"
                }`}
                style={{ background: c }}
              />
            ))}
            <label className="relative h-[1.65rem] w-[1.65rem] overflow-hidden rounded-full border-2 border-white/22">
              <span className="sr-only">Custom color</span>
              <input
                type="color"
                value={color}
                disabled={disabled}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onChange={(e) => patch({ color: e.target.value })}
              />
              <span className="block h-full w-full" style={{ background: color }} />
            </label>
          </div>

          <div className="mb-2 grid grid-cols-5 gap-[0.45rem]">
            {TOOL_ROW_1.map((item) => (
              <ToolBtn
                key={item.id}
                title={item.title}
                icon={item.icon}
                disabled={disabled}
                active={tool === item.id}
                onClick={() => handleToolClick(item)}
              />
            ))}
          </div>
          <div className="grid grid-cols-5 gap-[0.45rem]">
            {TOOL_ROW_2.map((item) => (
              <ToolBtn
                key={item.id}
                title={item.title}
                icon={item.icon}
                disabled={
                  disabled &&
                  item.action !== "fit" &&
                  item.action !== "grid" &&
                  item.action !== "strongpoints"
                }
                active={
                  item.action === "grid"
                    ? showGrid
                    : item.action === "strongpoints"
                      ? showStrongpoints
                      : tool === item.id
                }
                onClick={() => handleToolClick(item)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-[10px] border border-white/10 bg-black/[0.22] p-3">
          <h3 className="mb-2 text-xs font-medium text-white/70">
            {tool === "select" ? "Select" : tool.charAt(0).toUpperCase() + tool.slice(1)}
          </h3>

          {tool === "select" && (
            <>
              <button
                type="button"
                disabled={disabled}
                onClick={onPaste}
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-[10px] border border-white/10 bg-black/[0.28] px-3 py-2 text-sm text-white/[0.72] hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
              >
                <i className="fa-solid fa-paste" aria-hidden="true" />
                Paste
              </button>
              <p className="text-[0.75rem] leading-relaxed text-white/45">
                Click a shape to select. Copy Ctrl+C, cut Ctrl+X, paste Ctrl+V, duplicate Ctrl+D.
              </p>
            </>
          )}

          {tool !== "select" && (
            <label className="mb-2 flex items-center gap-2 text-[0.75rem] text-white/55">
              Size
              <input
                type="range"
                min={1}
                max={24}
                value={strokeWidth}
                disabled={disabled}
                className="flex-1"
                onChange={(e) => patch({ strokeWidth: Number(e.target.value) })}
              />
            </label>
          )}

          {(tool === "rect" || tool === "ellipse" || tool === "pen") && (
            <label className="mb-2 flex items-center gap-2 text-[0.75rem] text-white/55">
              <input
                type="checkbox"
                checked={filled}
                disabled={disabled}
                onChange={(e) => patch({ filled: e.target.checked })}
              />
              Fill
            </label>
          )}

          {selected && (
            <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
              <div className="text-[0.7rem] uppercase tracking-wide text-white/40">
                Selected · {selected.type}
              </div>
              <label className="flex items-center gap-2 text-[0.75rem] text-white/55">
                Color
                <input
                  type="color"
                  value={selected.style?.color || color}
                  disabled={disabled}
                  onChange={(e) => onUpdateSelected?.({ style: { color: e.target.value } })}
                />
              </label>
              {selected.type === "text" && (
                <textarea
                  className="min-h-[56px] w-full rounded-lg border border-white/10 bg-black/40 p-2 text-xs text-white"
                  defaultValue={selected.meta?.text || ""}
                  disabled={disabled}
                  onBlur={(e) =>
                    onUpdateSelected?.({ meta: { text: e.target.value.slice(0, 200) } })
                  }
                />
              )}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={onUndo}
              className="flex-1 rounded-[10px] border border-white/10 bg-black/[0.28] px-2 py-1.5 text-[0.7rem] text-white/[0.72] hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
            >
              Undo
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onRedo}
              className="flex-1 rounded-[10px] border border-white/10 bg-black/[0.28] px-2 py-1.5 text-[0.7rem] text-white/[0.72] hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
            >
              Redo
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}
