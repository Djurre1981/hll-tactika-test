import { useMemo, useState } from "react";
import {
  actionBtn,
  actionBtnWide,
  cx,
  glassInput,
  HLL_OPTIONS,
  ICON_OPTIONS,
  getHllToolbarPreviewSrc,
  sectionTitle,
} from "./editorUi.js";
import { StratIcon } from "./StratIcon.jsx";
import { Segmented, SizeOption } from "./ToolsPanelPrimitives.jsx";

const HLL_GROUPS = [...new Set(HLL_OPTIONS.map((o) => o.group))];

function matchesQuery(haystack, query) {
  if (!query) return true;
  return String(haystack || "")
    .toLowerCase()
    .includes(query);
}

export function ToolsPanelOptions({
  tool,
  disabled,
  selected,
  isStroke,
  isShape,
  strokeWidth,
  lineType,
  endType,
  filled,
  fontSize,
  textStyle,
  textAlign,
  iconId,
  iconLabel,
  hllId,
  hllRadiusCheck,
  patch,
  onPaste,
  onUpdateSelected,
  onUndo,
  onRedo,
}) {
  const [iconQuery, setIconQuery] = useState("");
  const [hllQuery, setHllQuery] = useState("");
  const [openHllGroups, setOpenHllGroups] = useState(() => new Set(["Spawn"]));

  const iconFilter = iconQuery.trim().toLowerCase();
  const hllFilter = hllQuery.trim().toLowerCase();

  const filteredIcons = useMemo(
    () => ICON_OPTIONS.filter((opt) => matchesQuery(opt.id, iconFilter)),
    [iconFilter]
  );

  const filteredHllByGroup = useMemo(() => {
    const map = {};
    for (const group of HLL_GROUPS) {
      map[group] = HLL_OPTIONS.filter(
        (o) =>
          o.group === group &&
          (matchesQuery(o.label, hllFilter) ||
            matchesQuery(o.id, hllFilter) ||
            matchesQuery(o.group, hllFilter))
      );
    }
    return map;
  }, [hllFilter]);

  const toggleHllGroup = (group) => {
    setOpenHllGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  return (
    <section className="mt-1 border-t border-solid border-white/[0.08] pt-3">
      {tool === "select" && (
        <>
          <h3 className={cx(sectionTitle, "mb-[0.55rem]")}>Select</h3>
          <button
            type="button"
            disabled={disabled}
            onClick={onPaste}
            className={cx(actionBtnWide, "mb-2")}
            title="Paste (Ctrl+V)"
          >
            <i className="fa-solid fa-paste" aria-hidden="true" />
            <span>Paste</span>
          </button>

          {selected ? (
            <div className="space-y-2">
              <p className="m-0 text-[0.68rem] leading-relaxed text-white/45">
                Selected object actions are under Tools. Copy Ctrl+C, cut Ctrl+X, duplicate Ctrl+D.
              </p>
              {selected.type === "text" && (
                <textarea
                  className="min-h-[56px] w-full rounded-[10px] border border-white/10 bg-black/40 p-2 text-xs text-white outline-none focus:border-white/25"
                  defaultValue={selected.meta?.text || ""}
                  key={selected.id}
                  disabled={disabled}
                  onBlur={(e) =>
                    onUpdateSelected?.({ meta: { text: e.target.value.slice(0, 200) } })
                  }
                />
              )}
            </div>
          ) : (
            <p className="m-0 text-[0.76rem] leading-relaxed text-white/45">
              Click a shape to select. Copy Ctrl+C, cut Ctrl+X, paste Ctrl+V, duplicate Ctrl+D.
            </p>
          )}
        </>
      )}

      {isStroke && (
        <>
          <h3 className={cx(sectionTitle, "mb-[0.55rem]")}>Stroke</h3>
          <p className="mb-2 text-[0.76rem] leading-relaxed text-white/45">
            {tool === "curve"
              ? "Drag to place a spline; select and pull the red discs to bend. Vertices are larger, control points smaller. Shift snaps the chord to 45°."
              : "Shift snaps lines and arrows to 45°."}
          </p>
          <SizeOption
            label="Size"
            value={strokeWidth}
            min={1}
            max={24}
            disabled={disabled}
            onChange={(v) => patch({ strokeWidth: v })}
          />
          <div className="mb-[0.55rem] flex flex-wrap items-center justify-between gap-2 text-[0.76rem] text-white/[0.72]">
            <span>Line type</span>
            <Segmented
              disabled={disabled}
              value={lineType}
              onChange={(v) => patch({ lineType: v })}
              options={[
                { value: "solid", title: "Solid", label: <i className="fa-solid fa-minus" /> },
                { value: "dashed", title: "Dashed", label: <i className="fa-solid fa-grip-lines" /> },
                { value: "dotted", title: "Dotted", label: <i className="fa-solid fa-ellipsis" /> },
              ]}
            />
          </div>
          <div className="mb-[0.55rem] flex flex-wrap items-center justify-between gap-2 text-[0.76rem] text-white/[0.72]">
            <span>End type</span>
            <Segmented
              disabled={disabled}
              value={endType}
              onChange={(v) => patch({ endType: v })}
              options={[
                { value: "none", title: "None", label: <i className="fa-solid fa-minus" /> },
                { value: "start", title: "Start arrow", label: <i className="fa-solid fa-arrow-left" /> },
                { value: "end", title: "End arrow", label: <i className="fa-solid fa-arrow-right" /> },
                { value: "both", title: "Both arrows", label: <i className="fa-solid fa-arrows-left-right" /> },
              ]}
            />
          </div>
        </>
      )}

      {isShape && (
        <>
          <h3 className={cx(sectionTitle, "mb-[0.55rem]")}>Shape</h3>
          <p className="mb-2 text-[0.76rem] leading-relaxed text-white/45">
            Shift keeps circles round and squares square. Alt draws from center.
          </p>
          <SizeOption
            label="Size"
            value={strokeWidth}
            min={1}
            max={24}
            disabled={disabled}
            onChange={(v) => patch({ strokeWidth: v })}
          />
          <div className="mb-[0.55rem] flex flex-wrap items-center justify-between gap-2 text-[0.76rem] text-white/[0.72]">
            <span>Line type</span>
            <Segmented
              disabled={disabled}
              value={lineType}
              onChange={(v) => patch({ lineType: v })}
              options={[
                { value: "solid", title: "Solid", label: <i className="fa-solid fa-minus" /> },
                { value: "dashed", title: "Dashed", label: <i className="fa-solid fa-grip-lines" /> },
                { value: "dotted", title: "Dotted", label: <i className="fa-solid fa-ellipsis" /> },
              ]}
            />
          </div>
          <label className="mb-[0.55rem] flex items-center gap-[0.45rem] text-[0.76rem] text-white/[0.72]">
            <input
              type="checkbox"
              checked={filled}
              disabled={disabled}
              onChange={(e) => patch({ filled: e.target.checked })}
            />
            <span>Filled</span>
          </label>
        </>
      )}

      {tool === "text" && (
        <>
          <h3 className={cx(sectionTitle, "mb-[0.55rem]")}>Text</h3>
          <SizeOption
            label="Font size"
            value={fontSize}
            min={8}
            max={48}
            disabled={disabled}
            onChange={(v) => patch({ fontSize: v })}
          />
          <div className="mb-[0.55rem] flex flex-wrap items-center justify-between gap-2 text-[0.76rem] text-white/[0.72]">
            <span>Text type</span>
            <Segmented
              disabled={disabled}
              value={textStyle}
              onChange={(v) => patch({ textStyle: v })}
              options={[
                { value: 0, title: "Regular", label: "Aa" },
                { value: 1, title: "Italic", label: <em>I</em> },
                { value: 2, title: "Bold", label: <strong>B</strong> },
              ]}
            />
          </div>
          <div className="mb-[0.55rem] flex flex-wrap items-center justify-between gap-2 text-[0.76rem] text-white/[0.72]">
            <span>Alignment</span>
            <Segmented
              disabled={disabled}
              value={textAlign}
              onChange={(v) => patch({ textAlign: v })}
              options={[
                { value: "left", title: "Left", label: <i className="fa-solid fa-align-left" /> },
                { value: "center", title: "Center", label: <i className="fa-solid fa-align-center" /> },
                { value: "right", title: "Right", label: <i className="fa-solid fa-align-right" /> },
              ]}
            />
          </div>
        </>
      )}

      {tool === "icons" && (
        <>
          <h3 className={cx(sectionTitle, "mb-[0.55rem]")}>Icons</h3>
          <label className="mb-2 block text-[0.76rem] text-white/[0.72]">
            <span className="mb-1 block">Label</span>
            <input
              type="text"
              maxLength={40}
              disabled={disabled}
              value={iconLabel}
              placeholder="Label (optional)"
              className={glassInput}
              onChange={(e) => patch({ iconLabel: e.target.value })}
            />
          </label>
          <label className="mb-2 block text-[0.76rem] text-white/[0.72]">
            <span className="sr-only">Filter icons</span>
            <input
              type="search"
              disabled={disabled}
              value={iconQuery}
              placeholder="Filter icons…"
              className={glassInput}
              onChange={(e) => setIconQuery(e.target.value)}
            />
          </label>
          <div
            className="grid max-h-64 grid-cols-5 gap-1 overflow-y-auto [--strat-icon-knockout:#1c1c1c]"
            role="radiogroup"
            aria-label="Icon"
          >
            {filteredIcons.map((opt) => (
              <button
                key={opt.id}
                type="button"
                title={opt.id}
                disabled={disabled}
                aria-pressed={iconId === opt.id}
                onClick={() => patch({ iconId: opt.id })}
                className={cx(
                  "flex aspect-square items-center justify-center rounded-[10px] border border-solid border-white/10 bg-transparent text-white/[0.78] transition hover:bg-white/[0.08]",
                  iconId === opt.id && "border-white/[0.22] bg-white/12 text-white hover:bg-white/12"
                )}
              >
                <StratIcon iconId={opt.id} className="h-[1.1rem] w-[1.1rem]" />
              </button>
            ))}
          </div>
          {filteredIcons.length === 0 ? (
            <p className="mt-2 m-0 text-[0.68rem] text-white/40">No icons match “{iconQuery.trim()}”.</p>
          ) : null}
        </>
      )}

      {tool === "hll" && (
        <>
          <h3 className={cx(sectionTitle, "mb-[0.55rem]")}>HLL Objects</h3>
          <label className="mb-[0.55rem] flex items-center gap-[0.45rem] text-[0.76rem] text-white/[0.72]">
            <input
              type="checkbox"
              checked={hllRadiusCheck !== false}
              disabled={disabled}
              onChange={(e) => patch({ hllRadiusCheck: e.target.checked })}
            />
            <span>Radius check</span>
          </label>
          <label className="mb-[0.55rem] block text-[0.76rem] text-white/[0.72]">
            <span className="sr-only">Filter HLL objects</span>
            <input
              type="search"
              disabled={disabled}
              value={hllQuery}
              placeholder="Filter objects…"
              className={glassInput}
              onChange={(e) => {
                const next = e.target.value;
                setHllQuery(next);
                const q = next.trim().toLowerCase();
                if (!q) return;
                // Auto-expand groups that have matches while filtering.
                setOpenHllGroups((prev) => {
                  const nextOpen = new Set(prev);
                  for (const group of HLL_GROUPS) {
                    const has = HLL_OPTIONS.some(
                      (o) =>
                        o.group === group &&
                        (matchesQuery(o.label, q) ||
                          matchesQuery(o.id, q) ||
                          matchesQuery(o.group, q))
                    );
                    if (has) nextOpen.add(group);
                  }
                  return nextOpen;
                });
              }}
            />
          </label>
          <div className="max-h-64 space-y-1 overflow-y-auto pr-0.5" role="radiogroup" aria-label="HLL object">
            {HLL_GROUPS.map((group) => {
              const items = filteredHllByGroup[group] || [];
              if (hllFilter && items.length === 0) return null;
              const open = openHllGroups.has(group) || Boolean(hllFilter);
              return (
                <div
                  key={group}
                  className="overflow-hidden rounded-[10px] border border-solid border-white/10 bg-black/[0.14]"
                >
                  <button
                    type="button"
                    disabled={disabled}
                    aria-expanded={open}
                    onClick={() => toggleHllGroup(group)}
                    className="flex w-full items-center gap-2 border-0 bg-transparent px-[0.55rem] py-[0.4rem] text-left transition hover:bg-white/[0.05]"
                  >
                    <i
                      className={cx(
                        "fa-solid fa-chevron-right text-[0.55rem] text-white/35 transition-transform",
                        open && "rotate-90"
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 text-[0.62rem] font-light uppercase tracking-[0.12em] text-white/45">
                      {group}
                    </span>
                    <span className="text-[0.58rem] tabular-nums text-white/30">{items.length}</span>
                  </button>
                  {open ? (
                    <div className="grid grid-cols-5 gap-1 border-t border-solid border-white/[0.06] px-1 pb-1.5 pt-1">
                      {items.map((opt) => {
                        const previewSrc = getHllToolbarPreviewSrc(opt);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            title={opt.label}
                            disabled={disabled}
                            aria-label={opt.label}
                            aria-pressed={hllId === opt.id}
                            onClick={() => patch({ hllId: opt.id })}
                            className={cx(
                              "flex aspect-square items-center justify-center rounded-[10px] border border-solid border-white/10 bg-transparent p-1 text-white/[0.78] transition hover:bg-white/[0.08]",
                              hllId === opt.id && "border-white/[0.22] bg-white/12 text-white"
                            )}
                          >
                            <img
                              src={previewSrc}
                              alt=""
                              className="h-full w-full object-contain"
                              draggable={false}
                            />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {hllFilter && HLL_GROUPS.every((g) => (filteredHllByGroup[g] || []).length === 0) ? (
              <p className="m-0 px-1 py-2 text-[0.68rem] text-white/40">
                No objects match “{hllQuery.trim()}”.
              </p>
            ) : null}
          </div>
        </>
      )}

      {(tool === "eraser" || tool === "ping") && (
        <>
          <h3 className={cx(sectionTitle, "mb-[0.55rem]")}>
            {tool === "eraser" ? "Eraser" : "Ping"}
          </h3>
          <p className="m-0 text-[0.76rem] leading-relaxed text-white/45">
            {tool === "eraser"
              ? "Click objects to remove them from the slide."
              : "Click the map to place a ping marker."}
          </p>
        </>
      )}

      <div className="mt-3 flex gap-2">
        <button type="button" disabled={disabled} onClick={onUndo} className={cx(actionBtn, "flex-1")}>
          Undo
        </button>
        <button type="button" disabled={disabled} onClick={onRedo} className={cx(actionBtn, "flex-1")}>
          Redo
        </button>
      </div>
    </section>
  );
}
