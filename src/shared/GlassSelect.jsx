import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Themed dropdown — replaces native select so hover/active colors match Tactika glass (no OS blue).
 */
export function GlassSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  className = "",
  displayStyle,
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label ?? placeholder;
  const hasValue = Boolean(value);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    function updatePosition() {
      const rect = buttonRef.current.getBoundingClientRect();
      const maxHeight = 208;
      const gap = 6;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
      const height = Math.min(maxHeight, openUp ? spaceAbove : spaceBelow);

      setMenuStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        maxHeight: height,
        zIndex: 9999,
        top: openUp ? rect.top - gap - height : rect.bottom + gap,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function onDocumentPointer(event) {
      if (
        !rootRef.current?.contains(event.target)
        && !event.target.closest?.(`[data-glass-select-menu="${listId}"]`)
      ) {
        setOpen(false);
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentPointer);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentPointer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, listId]);

  function choose(nextValue) {
    onChange(nextValue);
    setOpen(false);
  }

  const menu = open && menuStyle ? (
    <ul
      id={listId}
      role="listbox"
      data-glass-select-menu={listId}
      style={menuStyle}
      className="glass-select-menu overflow-y-auto overscroll-contain py-1"
    >
      {placeholder ? (
        <li
          role="option"
          aria-selected={!value}
          className={cx("glass-select-option", !value && "glass-select-option-selected")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => choose("")}
        >
          {placeholder}
        </li>
      ) : null}
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <li
            key={option.value || option.label}
            role="option"
            aria-selected={isSelected}
            className={cx("glass-select-option", isSelected && "glass-select-option-selected")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(option.value)}
          >
            {option.label}
          </li>
        );
      })}
    </ul>
  ) : null;

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className="glass-select text-left disabled:cursor-not-allowed"
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
      >
        <span
          style={displayStyle}
          className={hasValue ? "text-white" : "text-white/45"}
        >
          {displayLabel}
        </span>
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
