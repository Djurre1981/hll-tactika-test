import { lazy, Suspense, useCallback, useEffect, useRef } from "react";
import { Spinner } from "../../shared/Spinner.jsx";
import "@excalidraw/excalidraw/index.css";
import "./excalidraw-theme.css";

const Excalidraw = lazy(async () => {
  const mod = await import("@excalidraw/excalidraw");
  return { default: mod.Excalidraw };
});

function buildInitialData(scene, backgroundTransparent, theme) {
  const elements = Array.isArray(scene?.elements) ? scene.elements : [];
  const files = scene?.files && typeof scene.files === "object" ? scene.files : {};
  const isDark = theme !== "light";
  const appState = {
    ...(scene?.appState || {}),
    theme: isDark ? "dark" : "light",
    viewBackgroundColor: backgroundTransparent
      ? "transparent"
      : scene?.appState?.viewBackgroundColor || (isDark ? "#0f0f0f" : "#ffffff"),
  };
  return { elements, appState, files };
}

/**
 * Thin Excalidraw wrapper — API via ref callback / onApiReady (like CanvasWrapper).
 */
export function ExcalidrawCanvas({
  scene,
  hasBackground,
  theme = "dark",
  viewModeEnabled = false,
  onApiReady,
  onChange,
}) {
  const apiRef = useRef(null);
  const initialRef = useRef(null);
  const themeRef = useRef(theme);

  if (!initialRef.current) {
    initialRef.current = buildInitialData(scene, hasBackground, theme);
  }

  const handleApi = useCallback(
    (api) => {
      apiRef.current = api;
      onApiReady?.(api);
    },
    [onApiReady]
  );

  const handleChange = useCallback(
    (elements, appState, files) => {
      onChange?.(elements, appState, files);
    },
    [onChange]
  );

  useEffect(() => {
    if (themeRef.current === theme) return;
    themeRef.current = theme;
    const api = apiRef.current;
    if (!api) return;
    const isDark = theme !== "light";
    api.updateScene({
      appState: {
        theme: isDark ? "dark" : "light",
        viewBackgroundColor: hasBackground
          ? "transparent"
          : isDark
            ? "#0f0f0f"
            : "#ffffff",
      },
    });
  }, [theme, hasBackground]);

  useEffect(() => {
    return () => {
      apiRef.current = null;
    };
  }, []);

  return (
    <div className="tactika-excalidraw h-full w-full">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center gap-2 text-white/50">
            <Spinner /> Loading board…
          </div>
        }
      >
        <Excalidraw
          excalidrawAPI={handleApi}
          initialData={initialRef.current}
          onChange={handleChange}
          theme={theme === "light" ? "light" : "dark"}
          viewModeEnabled={viewModeEnabled}
          zenModeEnabled
          gridModeEnabled={false}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: false,
              clearCanvas: false,
              export: false,
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
              saveAsImage: true,
            },
            tools: { image: true },
          }}
        />
      </Suspense>
    </div>
  );
}
