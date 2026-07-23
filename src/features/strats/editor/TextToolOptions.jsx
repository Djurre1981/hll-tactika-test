import { useState } from "react";
import { TEXT_FONTS } from "@map-kernel/text-style.js";
import { GlassSelect } from "../../../shared/GlassSelect.jsx";
import { cx } from "./editorUi.js";
import { Segmented, SliderField } from "./ToolsPanelPrimitives.jsx";
import { TextColorMenu } from "./TextColorMenu.jsx";
import { TextShadowGrid } from "./TextShadowGrid.jsx";

function ColorSwatchButton({ label, color, open, disabled, onToggle }) {
  const isNone = !color || color === "none" || color === "transparent";
  return (
    <div className="relative min-w-0 flex-1">
      <span className="mb-1 block text-[0.62rem] font-light uppercase tracking-[0.1em] text-white/40">
        {label}
      </span>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={onToggle}
        className="flex h-[2.05rem] w-full items-center justify-center gap-1 rounded-[10px] border border-solid border-white/10 bg-black/25 px-1.5 hover:border-white/20"
      >
        <span
          className={cx(
            "h-5 w-5 rounded-[5px] border border-white/20",
            isNone && "bg-[repeating-conic-gradient(#444_0_25%,#222_0_50%)] bg-[length:6px_6px]"
          )}
          style={isNone ? undefined : { background: color }}
        />
        <i className="fa-solid fa-chevron-down text-[0.5rem] text-white/35" aria-hidden="true" />
      </button>
    </div>
  );
}

export function TextToolOptions({
  disabled,
  fontFamily,
  fontSize,
  color,
  outlineColor,
  outlineWidth,
  shadow,
  bold,
  italic,
  underline,
  textAlign,
  textVAlign,
  opacity,
  padding,
  setStyle,
  onEyedrop,
}) {
  const [menu, setMenu] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const activeFont = TEXT_FONTS.find((f) => f.id === (fontFamily || "Inter"));
  const fontOptions = TEXT_FONTS.map((f) => ({ value: f.id, label: f.label }));

  return (
    <>
      <label className="mb-[0.65rem] block text-[0.76rem] text-white/[0.72]">
        <span className="mb-1 block text-[0.62rem] font-light uppercase tracking-[0.1em] text-white/40">
          Font
        </span>
        <GlassSelect
          disabled={disabled}
          value={fontFamily || "Inter"}
          displayStyle={{ fontFamily: activeFont?.css || "Inter" }}
          onChange={(value) => setStyle({ fontFamily: value }, { fontFamily: value })}
          placeholder=""
          options={fontOptions}
        />
      </label>

      <div className="relative mb-[0.65rem] flex items-start gap-2">
        <ColorSwatchButton
          label="Fill"
          color={color}
          open={menu === "fill"}
          disabled={disabled}
          onToggle={() => setMenu((m) => (m === "fill" ? null : "fill"))}
        />
        <ColorSwatchButton
          label="Outline"
          color={outlineColor}
          open={menu === "outline"}
          disabled={disabled}
          onToggle={() => setMenu((m) => (m === "outline" ? null : "outline"))}
        />
        <TextShadowGrid
          value={shadow}
          disabled={disabled}
          onChange={(v) => setStyle({ shadow: v }, { shadow: v })}
        />
        {menu === "fill" ? (
          <TextColorMenu
            value={color}
            disabled={disabled}
            onChange={(v) => setStyle({ color: v }, { color: v })}
            onEyedrop={() => {
              setMenu(null);
              onEyedrop?.("fill");
            }}
            onClose={() => setMenu(null)}
          />
        ) : null}
        {menu === "outline" ? (
          <div className="absolute left-1/3 top-0 z-50 -translate-x-1/4">
            <TextColorMenu
              value={outlineColor}
              allowNone
              disabled={disabled}
              onChange={(v) => setStyle({ outlineColor: v }, { outlineColor: v })}
              onEyedrop={() => {
                setMenu(null);
                onEyedrop?.("outline");
              }}
              onClose={() => setMenu(null)}
            />
          </div>
        ) : null}
      </div>

      <SliderField
        label="Font size"
        value={fontSize}
        min={6}
        max={72}
        disabled={disabled}
        onChange={(v) => setStyle({ fontSize: v }, { fontSize: v })}
      />
      <SliderField
        label="Line width"
        value={outlineWidth}
        min={0}
        max={24}
        disabled={disabled || outlineColor === "none"}
        onChange={(v) => setStyle({ outlineWidth: v }, { outlineWidth: v })}
      />

      <button
        type="button"
        className="mb-2 flex w-full items-center justify-between border-0 bg-transparent px-0 py-1 text-left text-[0.62rem] font-light uppercase tracking-[0.12em] text-white/45"
        onClick={() => setAdvancedOpen((v) => !v)}
      >
        Advanced
        <i
          className={cx(
            "fa-solid fa-chevron-down text-[0.55rem] transition-transform",
            advancedOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {advancedOpen ? (
        <>
          <div className="mb-[0.55rem] flex flex-wrap items-center justify-between gap-2 text-[0.76rem] text-white/[0.72]">
            <span>Style</span>
            <div className="inline-flex flex-wrap gap-1">
              {[
                { key: "bold", label: <strong>B</strong>, title: "Bold", on: bold },
                { key: "italic", label: <em>I</em>, title: "Italic", on: italic },
                {
                  key: "underline",
                  label: <span className="underline">U</span>,
                  title: "Underline",
                  on: underline,
                },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  title={opt.title}
                  disabled={disabled}
                  aria-pressed={opt.on}
                  onClick={() => setStyle({ [opt.key]: !opt.on }, { [opt.key]: !opt.on })}
                  className={cx(
                    "inline-flex h-[1.8rem] min-w-[1.8rem] items-center justify-center rounded-[10px] border border-solid px-[0.35rem] text-[0.72rem] outline-none transition",
                    opt.on
                      ? "border-white/20 bg-white/12 text-white"
                      : "border-white/10 bg-transparent text-white/[0.72] hover:border-white/20 hover:bg-white/[0.08]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-[0.55rem] flex flex-wrap items-center justify-between gap-2 text-[0.76rem] text-white/[0.72]">
            <span>Align</span>
            <Segmented
              disabled={disabled}
              value={textAlign}
              onChange={(v) => setStyle({ textAlign: v }, { textAlign: v })}
              options={[
                { value: "left", title: "Left", label: <i className="fa-solid fa-align-left" /> },
                { value: "center", title: "Center", label: <i className="fa-solid fa-align-center" /> },
                { value: "right", title: "Right", label: <i className="fa-solid fa-align-right" /> },
              ]}
            />
          </div>
          <div className="mb-[0.55rem] flex flex-wrap items-center justify-between gap-2 text-[0.76rem] text-white/[0.72]">
            <span>Vertical</span>
            <Segmented
              disabled={disabled}
              value={textVAlign}
              onChange={(v) => setStyle({ textVAlign: v }, { textVAlign: v })}
              options={[
                { value: "top", title: "Top", label: <i className="fa-solid fa-arrow-up" /> },
                { value: "middle", title: "Middle", label: <i className="fa-solid fa-minus" /> },
                { value: "bottom", title: "Bottom", label: <i className="fa-solid fa-arrow-down" /> },
              ]}
            />
          </div>
          <SliderField
            label="Opacity"
            value={opacity}
            min={0}
            max={100}
            disabled={disabled}
            onChange={(v) => setStyle({ opacity: v }, { opacity: v })}
          />
          <SliderField
            label="Padding"
            value={padding}
            min={0}
            max={24}
            disabled={disabled}
            onChange={(v) => setStyle({ padding: v }, { padding: v })}
          />
        </>
      ) : null}
    </>
  );
}
