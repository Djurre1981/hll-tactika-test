import { cx, glassIconBtn, glassIconBtnActive } from "./editorUi.js";

export function IconBtn({ title, disabled, onClick, children, pressed }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cx(glassIconBtn, pressed && glassIconBtnActive)}
    >
      {children}
    </button>
  );
}

export function mapThumbUrl(mapId) {
  if (!mapId) return null;
  return `/maps/no-grid/${mapId}_NoGrid.webp`;
}
