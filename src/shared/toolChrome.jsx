import {
  cx,
  optionRow,
  segmentedBtn,
  segmentedBtnActive,
  toolBtn,
  toolBtnActive,
} from "./glassUi.js";

export function ToolBtn({ active, disabled, title, icon, iconSrc, iconNode, onClick }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cx(toolBtn, active && toolBtnActive)}
    >
      {iconSrc ? (
        <img src={iconSrc} alt="" className="h-[1.15rem] w-[1.15rem] object-contain" draggable={false} />
      ) : iconNode ? (
        iconNode
      ) : (
        <i className={icon} aria-hidden="true" />
      )}
    </button>
  );
}

export function Segmented({ options, value, disabled, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          title={opt.title}
          disabled={disabled}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cx(segmentedBtn, value === opt.value && segmentedBtnActive)}
        >
          {opt.icon ? <i className={opt.icon} aria-hidden="true" /> : opt.label}
        </button>
      ))}
    </div>
  );
}

export function SizeOption({ label, value, min, max, disabled, onChange }) {
  return (
    <label className={optionRow}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        className="w-full accent-white"
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output className="min-w-[1.5rem] text-right text-white/55">{value}</output>
    </label>
  );
}

/** Slider with editable number field (StratSketch-style Width / Opacity rows). */
export function SliderField({ label, value, min, max, disabled, onChange }) {
  const clamp = (n) => Math.min(max, Math.max(min, Number(n) || min));
  return (
    <label className="mb-[0.55rem] grid grid-cols-[4.25rem_minmax(0,1fr)_2.6rem] items-center gap-[0.45rem] text-[0.76rem] text-white/[0.72]">
      <span className="truncate">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        className="w-full accent-white"
        onChange={(e) => onChange(clamp(e.target.value))}
      />
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={label}
        className="w-full rounded-[8px] border border-solid border-white/10 bg-black/35 px-1 py-[0.2rem] text-center text-[0.72rem] tabular-nums text-white/85 outline-none focus:border-white/25 disabled:opacity-35"
        onChange={(e) => onChange(clamp(e.target.value))}
      />
    </label>
  );
}
