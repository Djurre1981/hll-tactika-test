import { useEffect, useRef, useState } from "react";
import { COLOR_PRESETS, cx } from "./editorUi.js";
import { hexToHsv, hexToRgb, hsvToHex, rgbToHex } from "./colorMath.js";
import { useFavoriteColors } from "./useFavoriteColors.js";

const EXTRA = ["#9ca3af", "#14b8a6", "#ec4899", "#64748b"];

export function TextColorMenu({
  value,
  allowNone = false,
  disabled,
  onChange,
  onEyedrop,
  onClose,
}) {
  const rootRef = useRef(null);
  const isNone = !value || value === "none" || value === "transparent";
  const active = isNone ? "#ffffff" : value;
  const [mode, setMode] = useState("hex");
  const [hsv, setHsv] = useState(() => hexToHsv(active));
  const { favorites, addFavorite } = useFavoriteColors();

  useEffect(() => {
    if (!isNone) setHsv(hexToHsv(active));
  }, [active, isNone]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  const commit = (hex) => onChange?.(hex);

  const setFromHsv = (next) => {
    setHsv(next);
    commit(hsvToHex(next.h, next.s, next.v));
  };

  const rgb = hexToRgb(active);
  const presets = [...COLOR_PRESETS, ...EXTRA];

  return (
    <div
      ref={rootRef}
      className="absolute left-0 top-full z-50 mt-1 w-[16.5rem] rounded-[12px] border border-solid border-white/12 bg-[rgba(28,28,30,0.97)] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
    >
      <div className="mb-2 flex flex-wrap items-start gap-1.5">
        {allowNone ? (
          <button
            type="button"
            disabled={disabled}
            title="None"
            onClick={() => commit("none")}
            className={cx(
              "h-6 w-6 rounded-[6px] border border-solid border-white/15 bg-[repeating-conic-gradient(#444_0_25%,#222_0_50%)] bg-[length:8px_8px]",
              isNone && "ring-2 ring-white/40"
            )}
          />
        ) : null}
        {presets.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            title={c}
            onClick={() => commit(c)}
            className={cx(
              "h-6 w-6 rounded-[6px] border border-solid border-white/15",
              !isNone && active.toLowerCase() === c.toLowerCase() && "ring-2 ring-white/40"
            )}
            style={{ background: c }}
          />
        ))}
        <button
          type="button"
          disabled={disabled}
          title="Pick from map"
          onClick={() => onEyedrop?.()}
          className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-solid border-white/15 bg-black/35 text-[0.7rem] text-white/80 hover:bg-white/10"
        >
          <i className="fa-solid fa-eye-dropper" aria-hidden="true" />
        </button>
      </div>

      <div className="mb-2 flex gap-2">
        <div
          className="relative h-[7.5rem] flex-1 cursor-crosshair rounded-[8px] border border-white/10"
          style={{
            background: `
              linear-gradient(to top, #000, transparent),
              linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`,
          }}
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const move = (ev) => {
              const s = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
              const v = 1 - Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
              setFromHsv({ ...hsv, s, v });
            };
            move(e);
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        >
          <span
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={360}
          value={hsv.h}
          disabled={disabled}
          aria-label="Hue"
          className="h-[7.5rem] w-3 cursor-pointer appearance-auto accent-white [writing-mode:vertical-lr] [direction:rtl]"
          onChange={(e) => setFromHsv({ ...hsv, h: Number(e.target.value) })}
        />
      </div>

      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode((m) => (m === "hex" ? "rgb" : "hex"))}
          className="rounded-[8px] border border-solid border-white/12 bg-black/30 px-2 py-1 text-[0.68rem] text-white/75 hover:bg-white/10"
        >
          Mode
        </button>
        {mode === "hex" ? (
          <label className="flex min-w-0 flex-1 items-center gap-1 text-[0.68rem] text-white/50">
            Hex
            <input
              type="text"
              disabled={disabled}
              value={isNone ? "" : active}
              className="min-w-0 flex-1 rounded-[8px] border border-white/12 bg-black/35 px-1.5 py-1 font-mono text-[0.72rem] text-white outline-none focus:border-white/25"
              onChange={(e) => {
                const v = e.target.value.trim();
                if (/^#[0-9a-fA-F]{6}$/.test(v)) commit(v);
              }}
            />
          </label>
        ) : (
          <div className="flex min-w-0 flex-1 gap-1">
            {["r", "g", "b"].map((k) => (
              <input
                key={k}
                type="number"
                min={0}
                max={255}
                disabled={disabled}
                aria-label={k.toUpperCase()}
                value={rgb[k]}
                className="w-full rounded-[8px] border border-white/12 bg-black/35 px-1 py-1 text-center font-mono text-[0.68rem] text-white outline-none focus:border-white/25"
                onChange={(e) => {
                  const next = { ...rgb, [k]: Number(e.target.value) };
                  commit(rgbToHex(next.r, next.g, next.b));
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[8px] border border-solid border-white/[0.08] bg-black/20 px-2 py-1.5">
        <p className="m-0 mb-1.5 text-center text-[0.62rem] uppercase tracking-[0.12em] text-white/40">
          My Colors
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={disabled || isNone}
            title="Add current"
            onClick={() => addFavorite(active)}
            className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-dashed border-white/25 text-white/60 hover:bg-white/10"
          >
            <i className="fa-solid fa-plus text-[0.65rem]" aria-hidden="true" />
          </button>
          {favorites.map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled}
              title={c}
              onClick={() => commit(c)}
              className="h-6 w-6 rounded-[6px] border border-solid border-white/15"
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
