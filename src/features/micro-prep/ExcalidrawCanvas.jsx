import { lazy, Suspense, useCallback, useEffect, useRef } from "react";
import { Spinner } from "../../shared/Spinner.jsx";
import { enforceHllMapAspectRatio } from "./insertMapImage.js";
import "@excalidraw/excalidraw/index.css";
import "./excalidraw-theme.css";

const Excalidraw = lazy(async () => {
  const mod = await import("@excalidraw/excalidraw");
  return { default: mod.Excalidraw };
});

/** Slideshow: start fully zoomed out; pan only within the page when zoomed in. */
const BOUNDED_ZOOM_MIN = 1;
const BOUNDED_ZOOM_MAX = 1.75;
const ZOOM_EPS = 0.02;

/** Slide/page fill — black / white. Letterbox greys live in WhiteboardEditor. */
const PAGE_COLOR = {
  dark: "#0f0f0f",
  light: "#ffffff",
};

function defaultPageColor(theme) {
  return theme === "light" ? PAGE_COLOR.light : PAGE_COLOR.dark;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function idealScroll(width, height, zoom) {
  return {
    scrollX: width / (2 * zoom),
    scrollY: height / (2 * zoom),
  };
}

/** Keep the viewport inside the zoom=1 page so blank canvas edges never show. */
function clampScrollToPage(scrollX, scrollY, width, height, zoom) {
  if (zoom <= BOUNDED_ZOOM_MIN + ZOOM_EPS) {
    return idealScroll(width, height, BOUNDED_ZOOM_MIN);
  }
  const minX = width / zoom - width / 2;
  const maxX = width / 2;
  const minY = height / zoom - height / 2;
  const maxY = height / 2;
  return {
    scrollX: clamp(scrollX, minX, maxX),
    scrollY: clamp(scrollY, minY, maxY),
  };
}

function buildInitialData(scene, backgroundTransparent, theme, bounded) {
  const elements = Array.isArray(scene?.elements) ? scene.elements : [];
  const files = scene?.files && typeof scene.files === "object" ? scene.files : {};

  const appState = {
    ...(scene?.appState || {}),
    // Always light inside Excalidraw — dark theme inverts inserted images.
    theme: "light",
    viewBackgroundColor: backgroundTransparent
      ? "transparent"
      : defaultPageColor(theme),
    ...(bounded
      ? {
          zoom: { value: BOUNDED_ZOOM_MIN },
          scrollX: scene?.appState?.scrollX,
          scrollY: scene?.appState?.scrollY,
        }
      : {}),
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
  bounded = false,
  viewModeEnabled = false,
  onApiReady,
  onChange,
}) {
  const apiRef = useRef(null);
  const initialRef = useRef(null);
  const themeRef = useRef(theme);
  const clampingRef = useRef(false);
  const aspectFixRef = useRef(false);

  if (!initialRef.current) {
    initialRef.current = buildInitialData(scene, hasBackground, theme, bounded);
  }

  const handleApi = useCallback(
    (api) => {
      apiRef.current = api;
      if (bounded) {
        // After layout, pin fully zoomed-out + centered (no pan at rest).
        requestAnimationFrame(() => {
          const state = api.getAppState();
          const z = BOUNDED_ZOOM_MIN;
          const { scrollX, scrollY } = idealScroll(
            state.width || 1,
            state.height || 1,
            z
          );
          clampingRef.current = true;
          api.updateScene({
            appState: { zoom: { value: z }, scrollX, scrollY },
          });
          requestAnimationFrame(() => {
            clampingRef.current = false;
          });
        });
      }
      onApiReady?.(api);
    },
    [bounded, onApiReady]
  );

  const handleChange = useCallback(
    async (elements, appState, files) => {
      if (!aspectFixRef.current && apiRef.current) {
        const { newElementWith, CaptureUpdateAction } = await import("@excalidraw/excalidraw");
        const nextElements = await enforceHllMapAspectRatio(elements, newElementWith);
        if (nextElements) {
          aspectFixRef.current = true;
          apiRef.current.updateScene({
            elements: nextElements,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          requestAnimationFrame(() => {
            aspectFixRef.current = false;
          });
          return;
        }
      }
      onChange?.(elements, appState, files);
    },
    [onChange]
  );

  const handleScrollChange = useCallback(
    (scrollX, scrollY, zoom) => {
      if (!bounded || clampingRef.current) return;
      const api = apiRef.current;
      if (!api) return;

      const appState = api.getAppState();
      const zRaw = typeof zoom === "object" && zoom ? zoom.value : zoom;
      const z = typeof zRaw === "number" ? zRaw : BOUNDED_ZOOM_MIN;
      const nextZ = clamp(z, BOUNDED_ZOOM_MIN, BOUNDED_ZOOM_MAX);
      const w = appState.width || 1;
      const h = appState.height || 1;
      const { scrollX: nextX, scrollY: nextY } = clampScrollToPage(
        scrollX,
        scrollY,
        w,
        h,
        nextZ
      );

      if (
        Math.abs(nextZ - z) < 0.001 &&
        Math.abs(nextX - scrollX) < 0.5 &&
        Math.abs(nextY - scrollY) < 0.5
      ) {
        return;
      }

      clampingRef.current = true;
      api.updateScene({
        appState: {
          zoom: { value: nextZ },
          scrollX: nextX,
          scrollY: nextY,
        },
      });
      requestAnimationFrame(() => {
        clampingRef.current = false;
      });
    },
    [bounded]
  );

  useEffect(() => {
    if (themeRef.current === theme) return;
    themeRef.current = theme;
    const api = apiRef.current;
    if (!api) return;
    api.updateScene({
      appState: {
        theme: "light",
        viewBackgroundColor: hasBackground
          ? "transparent"
          : defaultPageColor(theme),
      },
    });
  }, [theme, hasBackground]);

  useEffect(() => {
    return () => {
      apiRef.current = null;
    };
  }, []);

  return (
    <div
      className={`tactika-excalidraw h-full w-full${bounded ? " tactika-excalidraw--bounded" : ""}`}
    >
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
          onScrollChange={bounded ? handleScrollChange : undefined}
          theme="light"
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
