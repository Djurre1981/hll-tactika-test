import {
  cx,
  optionRow,
  segmentedBtn,
  segmentedBtnActive,
  toolBtn,
  toolBtnActive,
} from "./glassUi.js";

export function ToolBtn({ active, disabled, title, icon, onClick }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cx(toolBtn, active && toolBtnActive)}
    >
      <i className={icon} aria-hidden="true" />
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
