import { useEffect, useState } from "react";
import { Button } from "../../../shared/Button.jsx";

export function PropertiesPanel({ selected, onChange, disabled = false }) {
  const [text, setText] = useState("");
  const [color, setColor] = useState("#ffffff");
  const [size, setSize] = useState(3);

  useEffect(() => {
    if (!selected) return;
    setText(selected.meta?.text || "");
    setColor(selected.style?.color || "#ffffff");
    setSize(selected.style?.size || 3);
  }, [selected]);

  if (!selected) {
    return (
      <aside className="flex w-56 shrink-0 flex-col border-l border-border bg-surface p-3">
        <p className="text-xs text-muted">Select a shape to edit properties.</p>
      </aside>
    );
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-3 border-l border-border bg-surface p-3">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted">Selected</div>
        <div className="mt-1 text-sm">{selected.type}</div>
      </div>

      <label className="flex flex-col gap-1 text-xs text-muted">
        Color
        <input
          type="color"
          value={color}
          disabled={disabled}
          onChange={(e) => {
            setColor(e.target.value);
            onChange?.({ style: { color: e.target.value } });
          }}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted">
        Size
        <input
          type="range"
          min={1}
          max={48}
          value={size}
          disabled={disabled}
          onChange={(e) => {
            const next = Number(e.target.value);
            setSize(next);
            onChange?.({ style: { size: next } });
          }}
        />
      </label>

      {selected.type === "text" && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Text
          <textarea
            className="min-h-[64px] rounded border border-border bg-bg p-2 text-sm text-text"
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => onChange?.({ meta: { text: text.slice(0, 200) } })}
          />
        </label>
      )}

      <Button
        variant="secondary"
        disabled={disabled}
        className="mt-auto text-xs"
        onClick={() => onChange?.({ apply: true })}
      >
        Apply
      </Button>
    </aside>
  );
}
