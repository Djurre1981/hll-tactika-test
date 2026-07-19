import { TEXT_SHADOW_CELLS } from "@map-kernel/text-style.js";
import { cx } from "./editorUi.js";

export function TextShadowGrid({ value, disabled, onChange }) {
  return (
    <div className="mb-[0.65rem]">
      <span className="mb-1 block text-[0.62rem] font-light uppercase tracking-[0.1em] text-white/40">
        Shadow
      </span>
      <div
        className="grid w-fit grid-cols-3 gap-1 rounded-[10px] border border-solid border-white/10 bg-black/25 p-1.5"
        role="radiogroup"
        aria-label="Text shadow position"
      >
        {TEXT_SHADOW_CELLS.map((id) => {
          const active = (value || "none") === id;
          const isNone = id === "none";
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              title={isNone ? "No shadow" : `Shadow ${id.toUpperCase()}`}
              disabled={disabled}
              onClick={() => onChange?.(id)}
              className={cx(
                "flex h-6 w-6 items-center justify-center rounded-[5px] border border-solid transition",
                active
                  ? "border-white/35 bg-white/18 text-white"
                  : "border-white/10 bg-black/30 text-white/35 hover:bg-white/[0.08]"
              )}
            >
              {active ? (
                <i className="fa-solid fa-check text-[0.55rem]" aria-hidden="true" />
              ) : (
                <span
                  className={cx(
                    "block h-2 w-2 rounded-[2px]",
                    isNone ? "border border-dashed border-white/30" : "bg-white/45"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
