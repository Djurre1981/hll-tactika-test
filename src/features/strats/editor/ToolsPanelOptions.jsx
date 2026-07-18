import {
  actionBtn,
  actionBtnWide,
  cx,
  glassInput,
  ICON_OPTIONS,
  sectionTitle,
} from "./editorUi.js";
import { Segmented, SizeOption } from "./ToolsPanelPrimitives.jsx";

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
  patch,
  onPaste,
  onCopy,
  onDuplicate,
  onDeleteSelected,
  onUpdateSelected,
  onUndo,
  onRedo,
}) {
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
              <p className="m-0 text-[0.68rem] uppercase tracking-wide text-white/40">
                {selected.type}
              </p>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Selection actions">
                <button type="button" className={actionBtn} title="Copy (Ctrl+C)" disabled={disabled} onClick={onCopy}>
                  <i className="fa-solid fa-copy" aria-hidden="true" />
                </button>
                <button type="button" className={actionBtn} title="Duplicate (Ctrl+D)" disabled={disabled} onClick={onDuplicate}>
                  <i className="fa-solid fa-clone" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={cx(actionBtn, "hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200")}
                  title="Delete"
                  disabled={disabled}
                  onClick={onDeleteSelected}
                >
                  <i className="fa-solid fa-trash" aria-hidden="true" />
                </button>
              </div>
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
            Shift snaps lines and arrows to 45°.
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
          <div
            className="grid max-h-40 grid-cols-5 gap-1 overflow-y-auto"
            role="radiogroup"
            aria-label="Icon"
          >
            {ICON_OPTIONS.map((opt) => (
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
                <i className={`fa-solid ${opt.icon}`} aria-hidden="true" />
              </button>
            ))}
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
