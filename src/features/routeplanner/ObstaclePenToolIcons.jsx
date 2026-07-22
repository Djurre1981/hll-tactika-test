/** Pen draw tool icons — pen and mode (+/−) shown as separate glyphs. */
export function PenAddToolIcon({ className = "h-[1.15rem] w-[1.15rem]" }) {
  return (
    <span
      className={`inline-flex flex-col items-center justify-center gap-[0.12em] leading-none ${className}`}
      aria-hidden="true"
    >
      <i className="fa-solid fa-pen text-[0.82em]" />
      <i className="fa-solid fa-plus text-[0.58em] opacity-90" />
    </span>
  );
}

export function PenSubtractToolIcon({ className = "h-[1.15rem] w-[1.15rem]" }) {
  return (
    <span
      className={`inline-flex flex-col items-center justify-center gap-[0.12em] leading-none ${className}`}
      aria-hidden="true"
    >
      <i className="fa-solid fa-pen text-[0.82em]" />
      <i className="fa-solid fa-minus text-[0.58em] opacity-90" />
    </span>
  );
}
