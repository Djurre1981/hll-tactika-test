import { Button } from "../../../shared/Button.jsx";
import { useToolStore } from "../../../lib/stores/useToolStore.js";

const TOOLS = [
  { id: "select", label: "Select" },
  { id: "eraser", label: "Eraser" },
  { id: "pen", label: "Pen" },
  { id: "line", label: "Line" },
  { id: "arrow", label: "Arrow" },
  { id: "rect", label: "Rect" },
  { id: "ellipse", label: "Ellipse" },
  { id: "text", label: "Text" },
  { id: "icons", label: "Icon" },
  { id: "ping", label: "Ping" },
];

const COLORS = [
  "#ffffff",
  "#ff4444",
  "#44aaff",
  "#ffcc00",
  "#44dd66",
  "#ff8800",
  "#c084fc",
  "#111111",
];

const ICON_IDS = [
  "check",
  "xmark",
  "circle-question",
  "circle-info",
  "triangle-exclamation",
  "house",
  "ban",
  "binoculars",
  "bomb",
  "car-side",
  "truck-pickup",
  "jet-fighter",
  "crosshairs",
  "flag",
  "gun",
  "shield",
  "skull-crossbones",
  "person-rifle",
  "map-pin",
  "location-dot",
];

export function Toolbar({ onUndo, onRedo, disabled = false }) {
  const tool = useToolStore((s) => s.tool);
  const color = useToolStore((s) => s.color);
  const strokeWidth = useToolStore((s) => s.strokeWidth);
  const lineType = useToolStore((s) => s.lineType);
  const endType = useToolStore((s) => s.endType);
  const filled = useToolStore((s) => s.filled);
  const fontSize = useToolStore((s) => s.fontSize);
  const iconId = useToolStore((s) => s.iconId);
  const patch = useToolStore((s) => s.patch);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
      <div className="flex flex-wrap gap-1">
        {TOOLS.map((t) => (
          <Button
            key={t.id}
            variant={tool === t.id ? "primary" : "secondary"}
            disabled={disabled}
            className="!px-2 !py-1 text-xs"
            onClick={() => patch({ tool: t.id })}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div className="mx-1 h-6 w-px bg-border" />

      <div className="flex items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            title={c}
            className={`h-6 w-6 rounded-sm border ${color === c ? "border-accent ring-1 ring-accent" : "border-border"}`}
            style={{ background: c }}
            onClick={() => patch({ color: c })}
          />
        ))}
        <input
          type="color"
          value={color}
          disabled={disabled}
          className="h-6 w-8 cursor-pointer bg-transparent"
          onChange={(e) => patch({ color: e.target.value })}
        />
      </div>

      <label className="flex items-center gap-1 text-xs text-muted">
        Size
        <input
          type="range"
          min={1}
          max={24}
          value={strokeWidth}
          disabled={disabled}
          onChange={(e) => patch({ strokeWidth: Number(e.target.value) })}
        />
      </label>

      {(tool === "line" || tool === "arrow" || tool === "pen" || tool === "rect" || tool === "ellipse") && (
        <select
          className="rounded border border-border bg-bg px-2 py-1 text-xs"
          value={lineType}
          disabled={disabled}
          onChange={(e) => patch({ lineType: e.target.value })}
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      )}

      {tool === "arrow" && (
        <select
          className="rounded border border-border bg-bg px-2 py-1 text-xs"
          value={endType}
          disabled={disabled}
          onChange={(e) => patch({ endType: e.target.value })}
        >
          <option value="end">End</option>
          <option value="start">Start</option>
        </select>
      )}

      {(tool === "rect" || tool === "ellipse" || tool === "pen") && (
        <label className="flex items-center gap-1 text-xs text-muted">
          <input
            type="checkbox"
            checked={filled}
            disabled={disabled}
            onChange={(e) => patch({ filled: e.target.checked })}
          />
          Fill
        </label>
      )}

      {tool === "text" && (
        <label className="flex items-center gap-1 text-xs text-muted">
          Font
          <input
            type="range"
            min={6}
            max={48}
            value={fontSize}
            disabled={disabled}
            onChange={(e) => patch({ fontSize: Number(e.target.value) })}
          />
        </label>
      )}

      {tool === "icons" && (
        <select
          className="rounded border border-border bg-bg px-2 py-1 text-xs"
          value={iconId}
          disabled={disabled}
          onChange={(e) => patch({ iconId: e.target.value })}
        >
          {ICON_IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      )}

      <div className="ml-auto flex gap-1">
        <Button variant="ghost" disabled={disabled} className="!px-2 !py-1 text-xs" onClick={onUndo}>
          Undo
        </Button>
        <Button variant="ghost" disabled={disabled} className="!px-2 !py-1 text-xs" onClick={onRedo}>
          Redo
        </Button>
      </div>
    </div>
  );
}
