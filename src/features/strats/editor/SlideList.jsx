import { Button } from "../../../shared/Button.jsx";

export function SlideList({
  slides = [],
  activeSlideId,
  onSelect,
  onAdd,
  onRemove,
  onRename,
  disabled = false,
}) {
  const sorted = [...slides].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <aside className="flex w-48 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Slides</span>
        <Button
          variant="ghost"
          disabled={disabled}
          className="!px-2 !py-0.5 text-xs"
          onClick={onAdd}
        >
          +
        </Button>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {sorted.map((slide, index) => {
          const active = slide.id === activeSlideId;
          return (
            <li key={slide.id} className="mb-1">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(slide.id)}
                className={`w-full rounded border px-2 py-2 text-left text-xs transition ${
                  active
                    ? "border-accent bg-bg text-text"
                    : "border-transparent text-muted hover:border-border hover:text-text"
                }`}
              >
                <div className="font-medium">{slide.name || `Slide ${index + 1}`}</div>
                <div className="mt-0.5 text-[10px] opacity-70">{slide.mapId}</div>
              </button>
              {active && !disabled && (
                <div className="mt-1 flex gap-1 px-1">
                  <Button
                    variant="ghost"
                    className="!px-1 !py-0 text-[10px]"
                    onClick={() => {
                      const name = window.prompt("Slide name", slide.name || "");
                      if (name != null) onRename?.(slide.id, name);
                    }}
                  >
                    Rename
                  </Button>
                  {sorted.length > 1 && (
                    <Button
                      variant="ghost"
                      className="!px-1 !py-0 text-[10px] text-red-400"
                      onClick={() => onRemove?.(slide.id)}
                    >
                      Del
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
