import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthGate.jsx";
import { apiClient } from "../../lib/api-client.js";
import { Spinner } from "../../shared/Spinner.jsx";
import { ExcalidrawCanvas } from "./ExcalidrawCanvas.jsx";
import { SlidesPanel } from "./SlidesPanel.jsx";
import { WhiteboardToolsPanel } from "./WhiteboardToolsPanel.jsx";
import { useMutateWhiteboard } from "./hooks/useMutateWhiteboard.js";
import { useWhiteboardAutosave } from "./hooks/useWhiteboardAutosave.js";
import { useWhiteboardQuery } from "./hooks/useWhiteboardQuery.js";
import {
  captureSlideFromApi,
  emptySlide,
  ensureSlideshowScene,
  mergeActiveSlide,
  slideToExcalidrawScene,
  sortSlides,
} from "./slidesUtils.js";

const PANEL_WIDTH = "min(320px, calc(100vw - 3rem))";

export function WhiteboardEditor({ boardId, backTo = "/home" }) {
  const user = useAuth();
  const [api, setApi] = useState(null);
  const apiRef = useRef(null);
  const [title, setTitle] = useState(null);
  const [backgroundUrl, setBackgroundUrl] = useState(undefined);
  const [uploading, setUploading] = useState(false);
  const [activeTool, setActiveTool] = useState("selection");
  const [theme, setTheme] = useState("dark");
  const themeHydrated = useRef(false);

  const [slides, setSlides] = useState(null);
  const [activeSlideId, setActiveSlideId] = useState(null);
  const slidesRef = useRef(null);
  const activeSlideIdRef = useRef(null);
  const slidesHydrated = useRef(false);

  const query = useWhiteboardQuery(boardId);
  const mutation = useMutateWhiteboard(boardId);
  const board = query.data;
  const isSlideshow = board?.mode === "slideshow";

  useEffect(() => {
    if (!board || themeHydrated.current) return;
    themeHydrated.current = true;
    const saved =
      board.mode === "slideshow"
        ? board.scene?.slides?.[0]?.appState?.theme
        : board.scene?.appState?.theme;
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, [board]);

  useEffect(() => {
    if (!board || board.mode !== "slideshow" || slidesHydrated.current) return;
    slidesHydrated.current = true;
    const { slides: next } = ensureSlideshowScene(board.scene);
    setSlides(next);
    setActiveSlideId(next[0].id);
  }, [board]);

  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  useEffect(() => {
    activeSlideIdRef.current = activeSlideId;
  }, [activeSlideId]);

  const displayTitle = title ?? board?.title ?? "";
  const displayBg =
    backgroundUrl !== undefined ? backgroundUrl : board?.backgroundUrl ?? null;

  const canEdit =
    Boolean(board) &&
    ["owner", "admin", "editor", "assist"].includes(user.role) &&
    (["owner", "admin", "assist"].includes(user.role) ||
      board.createdBy === user.steamId);

  const getScene = useCallback(() => {
    if (isSlideshow) {
      const currentSlides = slidesRef.current;
      const slideId = activeSlideIdRef.current;
      if (!currentSlides?.length || !slideId) return null;
      if (!apiRef.current) {
        return { slides: currentSlides };
      }
      const captured = captureSlideFromApi(apiRef.current, theme);
      return { slides: mergeActiveSlide(currentSlides, slideId, captured) };
    }

    const excalApi = apiRef.current;
    if (!excalApi) return null;
    const appState = excalApi.getAppState();
    return {
      elements: excalApi.getSceneElements(),
      appState: {
        viewBackgroundColor: appState?.viewBackgroundColor,
        gridSize: appState?.gridSize,
        // Persist our chrome theme (Excalidraw itself stays light).
        theme,
      },
      files: excalApi.getFiles() || {},
    };
  }, [isSlideshow, theme]);

  const { markDirty } = useWhiteboardAutosave({
    enabled: canEdit,
    getScene,
    backgroundUrl: displayBg,
    title: displayTitle,
    mutateAsync: mutation.mutateAsync,
  });

  const onApiReady = useCallback((nextApi) => {
    apiRef.current = nextApi;
    setApi(nextApi);
  }, []);

  const onChange = useCallback(() => {
    markDirty();
  }, [markDirty]);

  const onTitleChange = (value) => {
    setTitle(value);
    markDirty();
  };

  const onBackgroundUpload = async (file) => {
    if (!canEdit) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiClient("/uploads/image", {
        method: "POST",
        body: form,
      });
      setBackgroundUrl(result.url);
      markDirty();
    } catch (error) {
      console.error("Background upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const onClearBackground = () => {
    setBackgroundUrl(null);
    markDirty();
  };

  const onThemeChange = (next) => {
    setTheme(next);
    markDirty();
  };

  const flushActiveSlide = useCallback(() => {
    const current = slidesRef.current;
    const slideId = activeSlideIdRef.current;
    if (!current?.length || !slideId) return current;
    const captured = captureSlideFromApi(apiRef.current, theme);
    const next = mergeActiveSlide(current, slideId, captured);
    setSlides(next);
    slidesRef.current = next;
    return next;
  }, [theme]);

  const onSelectSlide = (slideId) => {
    if (slideId === activeSlideIdRef.current) return;
    flushActiveSlide();
    apiRef.current = null;
    setApi(null);
    setActiveSlideId(slideId);
    markDirty();
  };

  const onAddSlide = () => {
    if (!canEdit) return;
    const current = flushActiveSlide() || [];
    const nextSlide = emptySlide(current.length);
    const next = [...sortSlides(current), nextSlide];
    setSlides(next);
    slidesRef.current = next;
    apiRef.current = null;
    setApi(null);
    setActiveSlideId(nextSlide.id);
    markDirty();
  };

  const onRemoveSlide = (slideId) => {
    if (!canEdit) return;
    const current = flushActiveSlide() || [];
    if (current.length <= 1) return;
    const sorted = sortSlides(current);
    const removeIdx = sorted.findIndex((s) => s.id === slideId);
    const next = sorted
      .filter((s) => s.id !== slideId)
      .map((s, i) => ({ ...s, order: i }));
    const switching = slideId === activeSlideIdRef.current;
    const nextActive = switching
      ? next[Math.min(Math.max(removeIdx, 0), next.length - 1)]?.id
      : activeSlideIdRef.current;
    setSlides(next);
    slidesRef.current = next;
    if (switching) {
      apiRef.current = null;
      setApi(null);
      setActiveSlideId(nextActive);
    }
    markDirty();
  };

  const onRenameSlide = (slideId, name) => {
    if (!canEdit || !name) return;
    const current = slidesRef.current || [];
    const next = current.map((s) => (s.id === slideId ? { ...s, name } : s));
    setSlides(next);
    slidesRef.current = next;
    markDirty();
  };

  const letterboxBg = theme === "light" ? "bg-[#e8e8ea]" : "bg-[#2e2e32]";
  const shellBg = isSlideshow
    ? letterboxBg
    : theme === "light"
      ? "bg-white"
      : "bg-[#0f0f0f]";
  const mutedText = theme === "light" ? "text-black/50" : "text-white/50";
  const stageBg = theme === "light" ? "bg-white" : "bg-[#0f0f0f]";
  const activeSlide = sortSlides(slides || []).find((s) => s.id === activeSlideId);
  const canvasScene = isSlideshow
    ? slideToExcalidrawScene(activeSlide, theme)
    : board?.scene;

  if (query.isLoading) {
    return (
      <div className={`flex h-full items-center justify-center gap-2 ${shellBg} ${mutedText}`}>
        <Spinner /> Loading board…
      </div>
    );
  }

  if (query.isError || !board) {
    return (
      <div className={`flex h-full flex-col items-center justify-center gap-3 ${shellBg} p-6`}>
        <p className={theme === "light" ? "text-black/60" : "text-white/60"}>
          {query.error?.message || "Board not found"}
        </p>
        <Link to={backTo} className="text-amber-300/90 hover:underline">
          Back to hub
        </Link>
      </div>
    );
  }

  if (isSlideshow && (!slides || !activeSlideId || !activeSlide)) {
    return (
      <div className={`flex h-full items-center justify-center gap-2 ${shellBg} ${mutedText}`}>
        <Spinner /> Loading slides…
      </div>
    );
  }

  const canvas = (
    <ExcalidrawCanvas
      key={isSlideshow ? activeSlideId : boardId}
      scene={canvasScene}
      hasBackground={Boolean(displayBg)}
      theme={theme}
      bounded={isSlideshow}
      viewModeEnabled={!canEdit}
      onApiReady={onApiReady}
      onChange={onChange}
    />
  );

  return (
    <div className={`relative h-full w-full overflow-hidden ${shellBg}`}>
      {!isSlideshow && displayBg ? (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${displayBg})` }}
          aria-hidden="true"
        />
      ) : null}

      {isSlideshow ? (
        <div
          className={`absolute inset-0 z-[1] flex items-center justify-center ${letterboxBg}`}
          style={{
            paddingTop: "1.5rem",
            paddingBottom: "1.5rem",
            paddingLeft: "calc(1.5rem + min(320px, calc(100vw - 3rem)))",
            paddingRight: "calc(1.5rem + min(320px, calc(100vw - 3rem)))",
          }}
        >
          <div
            className={`relative aspect-video max-h-full w-full overflow-hidden rounded-sm shadow-[0_24px_80px_rgba(0,0,0,0.45)] ${stageBg}`}
          >
            {displayBg ? (
              <div
                className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${displayBg})` }}
                aria-hidden="true"
              />
            ) : null}
            <div className="absolute inset-0 z-[1]">{canvas}</div>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 z-[1]">{canvas}</div>
      )}

      <div
        className="pointer-events-none absolute bottom-6 left-6 top-6 z-20"
        style={{ width: PANEL_WIDTH }}
      >
        <div className="pointer-events-auto h-full">
          <WhiteboardToolsPanel
            disabled={!canEdit}
            title={displayTitle}
            onTitleChange={onTitleChange}
            activeTool={activeTool}
            onToolChange={setActiveTool}
            api={api}
            theme={theme}
            onThemeChange={onThemeChange}
            onBackgroundUpload={onBackgroundUpload}
            uploading={uploading}
            hasBackground={Boolean(displayBg)}
            onClearBackground={onClearBackground}
            lockPan={isSlideshow}
          />
        </div>
      </div>

      {isSlideshow ? (
        <div
          className="pointer-events-none absolute bottom-6 right-6 top-6 z-20"
          style={{ width: PANEL_WIDTH }}
        >
          <div className="pointer-events-auto h-full">
            <SlidesPanel
              slides={slides}
              activeSlideId={activeSlideId}
              onSelect={onSelectSlide}
              onAdd={onAddSlide}
              onRemove={onRemoveSlide}
              onRename={onRenameSlide}
              disabled={!canEdit}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
