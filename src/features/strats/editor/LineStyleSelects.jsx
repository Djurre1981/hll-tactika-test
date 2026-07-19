import { useEffect, useId, useRef, useState } from "react";
import { cx } from "./editorUi.js";
import { CapPreview, DashPreview } from "./LineStylePreviews.jsx";

/**
 * Compact glass pulldown that shows a visual example of the current value
 * and a list of visual options (not text labels).
 */
export function VisualSelect({
  label,
  value,
  options,
  disabled,
  renderOption,
  onChange,
  menuClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div className="relative min-w-0 flex-1" ref={rootRef}>
      <span className="mb-1 block text-[0.62rem] font-light uppercase tracking-[0.1em] text-white/40">
        {label}
      </span>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        title={selected?.title || label}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "flex h-[2.05rem] w-full items-center gap-1 rounded-[10px] border border-solid border-white/10 bg-black/25 px-1.5 text-white/85 outline-none transition hover:border-white/20 hover:bg-black/35 focus:border-white/25 disabled:opacity-35"
        )}
      >
        <span className="flex h-[1.35rem] min-w-0 flex-1 items-center justify-center text-white/90">
          {selected ? renderOption(selected, true) : null}
        </span>
        <i className="fa-solid fa-chevron-down shrink-0 text-[0.55rem] text-white/35" aria-hidden="true" />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className={cx(
            "absolute left-0 right-0 z-40 mt-1 max-h-56 overflow-y-auto rounded-[10px] border border-solid border-white/12 bg-[rgba(28,28,30,0.96)] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-md",
            menuClassName
          )}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  title={opt.title}
                  className={cx(
                    "flex h-[1.85rem] w-full items-center justify-center rounded-[8px] border-0 bg-transparent px-1 text-white/85 transition hover:bg-white/[0.1]",
                    active && "bg-white/[0.14]"
                  )}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {renderOption(opt, false)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function CapSelect({ label, value, side, disabled, options, onChange }) {
  return (
    <VisualSelect
      label={label}
      value={value}
      options={options}
      disabled={disabled}
      onChange={onChange}
      renderOption={(opt) => (
        <CapPreview value={opt.value} side={side} className="h-[1.15rem] w-full max-w-[3.25rem]" />
      )}
    />
  );
}

export function DashSelect({ label, value, disabled, options, onChange }) {
  return (
    <VisualSelect
      label={label}
      value={value}
      options={options}
      disabled={disabled}
      onChange={onChange}
      menuClassName="min-w-[7.5rem]"
      renderOption={(opt) => <DashPreview value={opt.value} className="h-[1.15rem] w-full max-w-[4.5rem]" />}
    />
  );
}
