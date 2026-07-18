import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ToolBtn } from "../../shared/toolChrome.jsx";
import { applyDrawSettings, applyToolAndSettings } from "./applyDrawSettings.js";
import { ToolSettings } from "./ToolSettings.jsx";
import {
  DEFAULT_DRAW_SETTINGS,
  WB_TOOL_ITEMS,
  actionBtn,
  actionBtnWide,
  cx,
  glassInput,
  panelBody,
  panelDivider,
  panelGlassFill,
  panelShell,
  sectionTitle,
} from "./whiteboardUi.js";

function dispatchEditKey(key, { shift = false } = {}) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      code: key === "z" ? "KeyZ" : key === "y" ? "KeyY" : undefined,
      ctrlKey: true,
      metaKey: true,
      shiftKey: shift,
      bubbles: true,
    })
  );
}

const TOOL_PRESETS = {
  sticky: {
    ...DEFAULT_DRAW_SETTINGS,
    strokeColor: "#a16207",
    backgroundColor: "#fef08a",
    fillStyle: "solid",
    roughness: 1,
  },
  highlighter: {
    ...DEFAULT_DRAW_SETTINGS,
    strokeColor: "#facc15",
    opacity: 40,
    strokeWidth: 4,
  },
  freedraw: {
    ...DEFAULT_DRAW_SETTINGS,
    opacity: 100,
    strokeWidth: 1,
  },
};

export function WhiteboardToolsPanel({
  disabled = false,
  title,
  onTitleChange,
  activeTool,
  onToolChange,
  api,
  theme = "dark",
  onThemeChange,
  onUndo,
  onRedo,
  onBackgroundUpload,
  uploading = false,
  hasBackground = false,
  onClearBackground,
  /** Slideshow: hide free pan — viewport is clamped on the stage. */
  lockPan = false,
}) {
  const fileRef = useRef(null);
  const [tool, setTool] = useState(activeTool || "selection");
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_DRAW_SETTINGS,
    strokeColor: theme === "light" ? "#1e1e1e" : "#ffffff",
  }));

  useEffect(() => {
    if (!api) return;
    applyDrawSettings(api, tool, settings);
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps -- sync once API mounts

  useEffect(() => {
    if (!lockPan || tool !== "hand") return;
    setTool("selection");
    onToolChange?.("selection");
    applyToolAndSettings(api, "selection", settings);
  }, [lockPan]); // eslint-disable-line react-hooks/exhaustive-deps -- only when lock toggles

  const selectTool = (id) => {
    const nextSettings = TOOL_PRESETS[id]
      ? {
          ...DEFAULT_DRAW_SETTINGS,
          strokeColor: theme === "light" ? "#1e1e1e" : "#ffffff",
          ...TOOL_PRESETS[id],
        }
      : id === "image"
        ? { ...settings, opacity: 100 }
        : settings;
    if (TOOL_PRESETS[id] || id === "image") setSettings(nextSettings);
    setTool(id);
    onToolChange?.(id);
    applyToolAndSettings(api, id, nextSettings);
  };

  const onSettingsChange = (next) => {
    setSettings(next);
    applyDrawSettings(api, tool, next);
  };

  const handleThemeChange = (next) => {
    setSettings((prev) => {
      const nextStroke =
        next === "light" && prev.strokeColor === "#ffffff"
          ? "#1e1e1e"
          : next === "dark" && prev.strokeColor === "#1e1e1e"
            ? "#ffffff"
            : prev.strokeColor;
      const updated = { ...prev, strokeColor: nextStroke };
      // Only update pen defaults — never restyle existing elements (esp. images).
      applyDrawSettings(api, tool, updated, { elements: false });
      return updated;
    });
    onThemeChange?.(next);
  };

  const isDark = theme === "dark";
  const tools = lockPan
    ? WB_TOOL_ITEMS.filter((item) => item.id !== "hand")
    : WB_TOOL_ITEMS;

  return (
    <aside className={panelShell} aria-label="Whiteboard tools">
      <div className={panelGlassFill} aria-hidden="true" />

      <div className={cx(panelBody, "overflow-y-auto")}>
        <div className="shrink-0">
          <Link
            to="/home"
            aria-label="Back to dashboard"
            className="mb-5 block w-fit max-w-[14rem] opacity-[0.92] transition hover:opacity-80"
          >
            <img
              src="/assets/logos/tactika-full-logo.svg"
              alt="Hell Let Loose Tactika"
              className="h-12 w-auto max-w-full object-contain object-left"
            />
          </Link>
          <div className={panelDivider} role="presentation" />
          <div className="flex items-center justify-between gap-2 pt-3">
            <p className={sectionTitle}>Micro Prep</p>
            <button
              type="button"
              className={actionBtn}
              title={isDark ? "Switch to white mode" : "Switch to black mode"}
              aria-pressed={!isDark}
              disabled={disabled}
              onClick={() => handleThemeChange(isDark ? "light" : "dark")}
            >
              <i
                className={isDark ? "fa-regular fa-sun" : "fa-regular fa-moon"}
                aria-hidden="true"
              />
              <span>{isDark ? "White" : "Black"}</span>
            </button>
          </div>
        </div>

        <div className={panelDivider} />

        <label className="block shrink-0">
          <span className={sectionTitle}>Title</span>
          <input
            type="text"
            value={title}
            disabled={disabled}
            onChange={(e) => onTitleChange?.(e.target.value)}
            className={cx(glassInput, "mt-2")}
            placeholder="Board title"
          />
        </label>

        <div className={panelDivider} />

        <div>
          <p className={sectionTitle}>Tools</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {tools.map((item) => (
              <ToolBtn
                key={item.id}
                active={tool === item.id}
                disabled={disabled}
                title={item.title}
                icon={item.icon}
                onClick={() => selectTool(item.id)}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            className={actionBtn}
            disabled={disabled}
            title="Undo"
            onClick={() => {
              onUndo?.();
              dispatchEditKey("z");
            }}
          >
            <i className="fa-solid fa-rotate-left" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={actionBtn}
            disabled={disabled}
            title="Redo"
            onClick={() => {
              onRedo?.();
              dispatchEditKey("z", { shift: true });
            }}
          >
            <i className="fa-solid fa-rotate-right" aria-hidden="true" />
          </button>
        </div>

        <div className={panelDivider} />

        <ToolSettings
          tool={tool}
          settings={settings}
          disabled={disabled}
          onChange={onSettingsChange}
        />

        <div className={panelDivider} />

        <div>
          <p className={sectionTitle}>Background</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onBackgroundUpload?.(file);
            }}
          />
          <button
            type="button"
            className={cx(actionBtnWide, "mt-2")}
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
          >
            <i className="fa-solid fa-panorama" aria-hidden="true" />
            {uploading ? "Uploading…" : "Set background"}
          </button>
          {hasBackground ? (
            <button
              type="button"
              className={cx(actionBtnWide, "mt-1.5")}
              disabled={disabled}
              onClick={() => onClearBackground?.()}
            >
              Clear background
            </button>
          ) : null}
          <p className="mt-2 text-[0.65rem] font-light leading-snug text-white/35">
            Use the Image tool above to place pictures on the canvas.
          </p>
        </div>
      </div>
    </aside>
  );
}
