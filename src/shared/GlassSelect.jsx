import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

const FILTER_RESET_MS = 1200;
const TYPEAHEAD_KEY = /^[\p{L}\p{N}\s\-'.]$/u;

function normalizeForFilter(text) {
  return String(text || "").trim().toLowerCase();
}

function buildListItems(options, placeholder, filterQuery) {
  const query = normalizeForFilter(filterQuery);
  const filtered = query
    ? options.filter((option) => normalizeForFilter(option.label).includes(query))
    : options;
  const items = [];

  if (placeholder && !query) {
    items.push({ kind: "placeholder", value: "", label: placeholder });
  }

  for (const option of filtered) {
    items.push({ kind: "option", ...option });
  }

  return items;
}

/**
 * Themed dropdown — replaces native select so hover/active colors match Tactika glass (no OS blue).
 * Open menus support type-ahead filtering: type to narrow options, arrows + Enter to pick.
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
  const [filterQuery, setFilterQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const filterResetRef = useRef(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label ?? placeholder;
  const hasValue = Boolean(value);

  const listItems = useMemo(
    () => buildListItems(options, placeholder, filterQuery),
    [options, placeholder, filterQuery]
  );

  const resetFilterState = useCallback(() => {
    setFilterQuery("");
    setHighlightIndex(0);
    if (filterResetRef.current) {
      clearTimeout(filterResetRef.current);
      filterResetRef.current = null;
    }
  }, []);

  const bumpFilterReset = useCallback(() => {
    if (filterResetRef.current) clearTimeout(filterResetRef.current);
    filterResetRef.current = setTimeout(() => {
      setFilterQuery("");
      setHighlightIndex(0);
      filterResetRef.current = null;
    }, FILTER_RESET_MS);
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
    resetFilterState();
  }, [resetFilterState]);

  const choose = useCallback((nextValue) => {
    onChange(nextValue);
    closeMenu();
  }, [closeMenu, onChange]);

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
  }, [open, filterQuery, listItems.length]);

  useEffect(() => {
    if (!open) return undefined;

    function onDocumentPointer(event) {
      if (
        !rootRef.current?.contains(event.target)
        && !event.target.closest?.(`[data-glass-select-menu="${listId}"]`)
      ) {
        closeMenu();
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key === "Backspace" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setFilterQuery((current) => current.slice(0, -1));
        setHighlightIndex(0);
        bumpFilterReset();
        return;
      }

      if (
        event.key.length === 1
        && !event.ctrlKey
        && !event.metaKey
        && !event.altKey
        && TYPEAHEAD_KEY.test(event.key)
      ) {
        event.preventDefault();
        setFilterQuery((current) => current + event.key);
        setHighlightIndex(0);
        bumpFilterReset();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!listItems.length) return;
        setHighlightIndex((current) => Math.min(current + 1, listItems.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!listItems.length) return;
        setHighlightIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setHighlightIndex(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        setHighlightIndex(Math.max(0, listItems.length - 1));
        return;
      }

      if (event.key === "Enter") {
        const item = listItems[highlightIndex];
        if (!item) return;
        event.preventDefault();
        choose(item.value);
      }
    }

    document.addEventListener("mousedown", onDocumentPointer);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentPointer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [
    bumpFilterReset,
    choose,
    closeMenu,
    highlightIndex,
    listId,
    listItems,
    open,
  ]);

  useEffect(() => {
    setHighlightIndex((current) => {
      if (!listItems.length) return 0;
      return Math.min(current, listItems.length - 1);
    });
  }, [listItems.length, filterQuery]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const active = menuRef.current.querySelector("[data-glass-select-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open, listItems]);

  useEffect(() => () => {
    if (filterResetRef.current) clearTimeout(filterResetRef.current);
  }, []);

  const menu = open && menuStyle ? (
    <ul
      ref={menuRef}
      id={listId}
      role="listbox"
      data-glass-select-menu={listId}
      style={menuStyle}
      className="glass-select-menu glass-scroll overflow-y-auto overscroll-contain"
      aria-label={filterQuery ? `Filtered by ${filterQuery}` : undefined}
    >
      {filterQuery ? (
        <li
          aria-hidden="true"
          className="glass-select-filter-hint pointer-events-none select-none border-b border-white/[0.08] px-3 py-1.5 text-[0.68rem] font-light uppercase tracking-[0.08em] text-white/35"
        >
          Type to filter · {filterQuery}
        </li>
      ) : null}
      {!listItems.length ? (
        <li className="glass-select-option cursor-default text-white/40">No matches</li>
      ) : null}
      {listItems.map((item, index) => {
        const isSelected = item.value === value;
        const isActive = index === highlightIndex;
        return (
          <li
            key={item.value || item.label}
            role="option"
            aria-selected={isSelected}
            data-glass-select-active={isActive ? "true" : undefined}
            className={cx(
              "glass-select-option",
              isSelected && "glass-select-option-selected",
              isActive && "glass-select-option-active"
            )}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setHighlightIndex(index)}
            onClick={() => choose(item.value)}
          >
            {item.label}
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
          if (disabled) return;
          setOpen((current) => {
            if (current) {
              resetFilterState();
              return false;
            }
            resetFilterState();
            return true;
          });
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
