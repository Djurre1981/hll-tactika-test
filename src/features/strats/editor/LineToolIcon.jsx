/** Toolbar glyph: curved stroke + arrow tip — line / curve / arrow in one mark. */
export function LineToolIcon({ className = "h-[1.15rem] w-[1.15rem]" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 18C6.5 18 8 6 13 8c3 1.2 3.2 5.2 5.2 6.2"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15.4 11.1 21 9.4l-2.5 5.2z" fill="currentColor" />
    </svg>
  );
}
