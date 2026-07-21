import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthGate.jsx";
import { useKernelYjsBridge } from "../../lib/collab/bridges.js";
import { PRESENCE_ROOM_ID, whiteboardRoomId } from "../../lib/collab/provider.js";
import { useYjsRoom } from "../../lib/collab/useYjsRoom.js";
import { apiClient } from "../../lib/api-client.js";
import { Spinner } from "../../shared/Spinner.jsx";
import { CollabPeers } from "../../shared/CollabPeers.jsx";
import { MicroPrepCanvasWrapper } from "./MicroPrepCanvasWrapper.jsx";
import { MicroPrepToolsPanel } from "./MicroPrepToolsPanel.jsx";
import { SlidesPanel } from "./SlidesPanel.jsx";
import { useMutateWhiteboard } from "./hooks/useMutateWhiteboard.js";
import { useMicroPrepKernelAutosave } from "./hooks/useMicroPrepKernelAutosave.js";
import { useWhiteboardQuery } from "./hooks/useWhiteboardQuery.js";
import { insertHllMapPage } from "./insertMapImage.js";
import {
  MICRO_PREP_SCENE_VERSION,
  defaultPageUrl,
  normalizeWhiteboardScene,
} from "./microPrepPages.js";
import {
  captureSlideFromKernel,
  emptySlide,
  ensureSlideshowScene,
  getSlideObjects,
  mergeActiveSlide,
  slidePageUrl,
  sortSlides,
} from "./slidesUtils.js";

export const MICRO_PREP_PANEL_GAP = 16;
export const MICRO_PREP_PANEL_WIDTH = "min(320px, calc(100vw - 3rem))";

export function WhiteboardEditor({ boardId, backTo = "/home" }) {
  const user = useAuth();
  const kernelRef = useRef(null);
  const shellRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);

  const [title, setTitle] = useState(null);
  const [pageUrl, setPageUrl] = useState(undefined);
  const [uploading, setUploading] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [selected, setSelected] = useState(null);
  const [panelInsets, setPanelInsets] = useState({
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  });

  const themeHydrated = useRef(false);
  const pageUrlHydrated = useRef(false);

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
    if (!board || pageUrlHydrated.current) return;
    pageUrlHydrated.current = true;
    if (board.mode === "slideshow") return;
    const normalized = normalizeWhiteboardScene(board.scene, theme);
    const initial =
      normalized.pageUrl ||
      (typeof board.backgroundUrl === "string" && board.backgroundUrl
        ? board.backgroundUrl
        : null);
    setPageUrl(initial);
  }, [board, theme]);

  useEffect(() => {
    if (!board || board.mode !== "slideshow" || slidesHydrated.current) return;
    slidesHydrated.current = true;
    const { slides: next } = ensureSlideshowScene(board.scene, theme);
    setSlides(next);
    setActiveSlideId(next[0].id);
  }, [board, theme]);

  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  useEffect(() => {
    activeSlideIdRef.current = activeSlideId;
  }, [activeSlideId]);

  const displayTitle = title ?? board?.title ?? "";
  const activeSlide = sortSlides(slides || []).find((s) => s.id === activeSlideId);

  const resolvedPageUrl = isSlideshow
    ? activeSlide?.pageUrl ?? null
    : pageUrl !== undefined
      ? pageUrl
      : normalizeWhiteboardScene(board?.scene, theme).pageUrl;

  const hasCustomPage = isSlideshow
    ? Boolean(activeSlide?.pageUrl)
    : Boolean(resolvedPageUrl);

  const canEdit =
    Boolean(board) &&
    ["owner", "admin", "editor", "assist"].includes(user.role) &&
    (["owner", "admin", "assist"].includes(user.role) ||
      board.createdBy === user.steamId);

  const measureInsets = useCallback(() => {
    const shell = shellRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!shell) return;
    const shellRect = shell.getBoundingClientRect();
    const leftRect = left?.getBoundingClientRect();
    const rightRect = right?.getBoundingClientRect();
    setPanelInsets({
      left: leftRect
        ? Math.max(0, leftRect.right - shellRect.left + MICRO_PREP_PANEL_GAP)
        : 0,
      right: rightRect
        ? Math.max(0, shellRect.right - rightRect.left + MICRO_PREP_PANEL_GAP)
        : 0,
      top: isSlideshow ? 24 : 0,
      bottom: isSlideshow ? 24 : 0,
    });
  }, [isSlideshow]);

  useLayoutEffect(() => {
    measureInsets();
    const ro = new ResizeObserver(() => measureInsets());
    if (shellRef.current) ro.observe(shellRef.current);
    if (leftRef.current) ro.observe(leftRef.current);
    if (rightRef.current) ro.observe(rightRef.current);
    window.addEventListener("resize", measureInsets);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureInsets);
    };
  }, [measureInsets, board, isSlideshow]);

  const collab = useYjsRoom({
    roomId: boardId ? whiteboardRoomId(boardId) : null,
    enabled: Boolean(board && boardId),
    user,
    awarenessState: {
      path: `/tool/micro-prep/${boardId}`,
      context: "micro-prep",
    },
  });

  useYjsRoom({
    roomId: PRESENCE_ROOM_ID,
    enabled: Boolean(board && user?.steamId),
    user,
    awarenessState: {
      path: `/tool/micro-prep/${boardId}`,
      context: "micro-prep",
    },
  });

  const slideObjects = useMemo(
    () => (isSlideshow ? getSlideObjects(activeSlide) : []),
    [isSlideshow, activeSlide]
  );

  const whiteboardObjects = useMemo(() => {
    if (isSlideshow || !board) return [];
    return normalizeWhiteboardScene(board.scene, theme).objects;
  }, [isSlideshow, board, theme]);

  const seedObjects = isSlideshow ? slideObjects : whiteboardObjects;

  useKernelYjsBridge({
    doc: collab.doc,
    kernelRef,
    enabled: collab.connected,
    canEdit,
    seedObjects,
  });

  const buildScenePayload = useCallback(() => {
    const kernel = kernelRef.current;
    const captured = captureSlideFromKernel(kernel, theme);

    if (isSlideshow) {
      const currentSlides = slidesRef.current;
      const slideId = activeSlideIdRef.current;
      if (!currentSlides?.length || !slideId) {
        return {
          sceneVersion: MICRO_PREP_SCENE_VERSION,
          slides: currentSlides || [],
        };
      }
      return {
        sceneVersion: MICRO_PREP_SCENE_VERSION,
        slides: mergeActiveSlide(currentSlides, slideId, captured),
      };
    }

    return {
      sceneVersion: MICRO_PREP_SCENE_VERSION,
      objects: captured.objects,
      appState: { theme },
      pageUrl: captured.pageUrl ?? resolvedPageUrl ?? null,
    };
  }, [isSlideshow, theme, resolvedPageUrl]);

  const getPersistPayload = useCallback(
    () => ({
      title: displayTitle,
      scene: buildScenePayload(),
    }),
    [displayTitle, buildScenePayload]
  );

  useMicroPrepKernelAutosave({
    enabled: canEdit && !collab.connected,
    kernelRef,
    getPersistPayload,
    mutateAsync: mutation.mutateAsync,
  });

  const scheduleMetaSave = useCallback(() => {
    if (!canEdit || collab.connected) return;
    mutation.mutate(getPersistPayload());
  }, [canEdit, collab.connected, mutation, getPersistPayload]);

  const onTitleChange = (value) => {
    setTitle(value);
    scheduleMetaSave();
  };

  const onThemeChange = (next) => {
    setTheme(next);
    if (!hasCustomPage && !isSlideshow) {
      setPageUrl(null);
    }
    scheduleMetaSave();
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
      const url = result.url;
      if (isSlideshow) {
        flushActiveSlide();
        const slideId = activeSlideIdRef.current;
        const next = (slidesRef.current || []).map((s) =>
          s.id === slideId ? { ...s, pageUrl: url } : s
        );
        setSlides(next);
        slidesRef.current = next;
      } else {
        setPageUrl(url);
      }
      kernelRef.current?.setPageImage(url);
      kernelRef.current?.fitToView();
      scheduleMetaSave();
    } catch (error) {
      console.error("Page upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const onClearPageImage = () => {
    if (!canEdit) return;
    if (isSlideshow) {
      flushActiveSlide();
      const slideId = activeSlideIdRef.current;
      const next = (slidesRef.current || []).map((s) =>
        s.id === slideId ? { ...s, pageUrl: null } : s
      );
      setSlides(next);
      slidesRef.current = next;
      kernelRef.current?.setPageImage(defaultPageUrl(theme, true));
      kernelRef.current?.fitToView();
    } else {
      setPageUrl(null);
      kernelRef.current?.setFreeformBlankPage(theme);
    }
    scheduleMetaSave();
  };

  const onInsertHllMap = async (mapId, overlayOptions) => {
    const kernel = kernelRef.current;
    if (!kernel) return null;
    const url = await insertHllMapPage(kernel, mapId, overlayOptions);
    if (isSlideshow) {
      flushActiveSlide();
      const slideId = activeSlideIdRef.current;
      const next = (slidesRef.current || []).map((s) =>
        s.id === slideId ? { ...s, pageUrl: url } : s
      );
      setSlides(next);
      slidesRef.current = next;
    } else {
      setPageUrl(url);
    }
    scheduleMetaSave();
    return url;
  };

  const flushActiveSlide = useCallback(() => {
    const current = slidesRef.current;
    const slideId = activeSlideIdRef.current;
    if (!current?.length || !slideId) return current;
    const captured = captureSlideFromKernel(kernelRef.current, theme);
    const next = mergeActiveSlide(current, slideId, captured);
    setSlides(next);
    slidesRef.current = next;
    return next;
  }, [theme]);

  const onSelectSlide = (slideId) => {
    if (slideId === activeSlideIdRef.current) return;
    flushActiveSlide();
    setActiveSlideId(slideId);
    setSelected(null);
    scheduleMetaSave();
  };

  const onAddSlide = () => {
    if (!canEdit) return;
    const current = flushActiveSlide() || [];
    const nextSlide = emptySlide(current.length, undefined, theme);
    const next = [...sortSlides(current), nextSlide];
    setSlides(next);
    slidesRef.current = next;
    setActiveSlideId(nextSlide.id);
    setSelected(null);
    scheduleMetaSave();
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
      setActiveSlideId(nextActive);
      setSelected(null);
    }
    scheduleMetaSave();
  };

  const onRenameSlide = (slideId, name) => {
    if (!canEdit || !name) return;
    const current = slidesRef.current || [];
    const next = current.map((s) => (s.id === slideId ? { ...s, name } : s));
    setSlides(next);
    slidesRef.current = next;
    scheduleMetaSave();
  };

  const letterboxBg = theme === "light" ? "bg-[#e8e8ea]" : "bg-[#2e2e32]";
  const shellBg = isSlideshow
    ? letterboxBg
    : theme === "light"
      ? "bg-white"
      : "bg-[#0f0f0f]";
  const mutedText = theme === "light" ? "text-black/50" : "text-white/50";
  const stageBg = theme === "light" ? "bg-white" : "bg-[#0f0f0f]";

  const canvasSlideKey = isSlideshow ? activeSlideId : boardId;
  const canvasObjects = isSlideshow ? slideObjects : whiteboardObjects;
  const canvasPageUrl = isSlideshow
    ? slidePageUrl(activeSlide, theme)
    : resolvedPageUrl;

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
    <MicroPrepCanvasWrapper
      kernelRef={kernelRef}
      slideKey={canvasSlideKey}
      objects={canvasObjects}
      pageUrl={canvasPageUrl}
      theme={theme}
      slideshow={isSlideshow}
      locked={!canEdit}
      panelInsets={panelInsets}
      onSelectionChange={setSelected}
    />
  );

  return (
    <div ref={shellRef} className={`relative h-full w-full overflow-hidden ${shellBg}`}>
      {isSlideshow ? (
        <div
          className={`absolute inset-0 z-[1] flex items-center justify-center ${letterboxBg}`}
          style={{
            paddingTop: "1.5rem",
            paddingBottom: "1.5rem",
            paddingLeft: `calc(1.5rem + ${MICRO_PREP_PANEL_WIDTH})`,
            paddingRight: `calc(1.5rem + ${MICRO_PREP_PANEL_WIDTH})`,
          }}
        >
          <div
            className={`relative aspect-video max-h-full w-full overflow-hidden rounded-sm shadow-[0_24px_80px_rgba(0,0,0,0.45)] ${stageBg}`}
          >
            <div className="absolute inset-0 z-[1]">{canvas}</div>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 z-[1]">{canvas}</div>
      )}

      <div className="absolute right-6 top-6 z-30">
        <CollabPeers peers={collab.peers} status={collab.status} />
      </div>

      <div
        ref={leftRef}
        className="pointer-events-none absolute bottom-6 left-6 top-6 z-20"
        style={{ width: MICRO_PREP_PANEL_WIDTH }}
      >
        <div className="pointer-events-auto h-full">
          <MicroPrepToolsPanel
            disabled={!canEdit}
            kernelRef={kernelRef}
            title={displayTitle}
            onTitleChange={onTitleChange}
            theme={theme}
            onThemeChange={onThemeChange}
            onBackgroundUpload={onBackgroundUpload}
            uploading={uploading}
            hasPageImage={hasCustomPage}
            onClearPageImage={onClearPageImage}
            onInsertHllMap={onInsertHllMap}
            selected={selected}
            onSelectionChange={setSelected}
          />
        </div>
      </div>

      {isSlideshow ? (
        <div
          ref={rightRef}
          className="pointer-events-none absolute bottom-6 right-6 top-6 z-20"
          style={{ width: MICRO_PREP_PANEL_WIDTH }}
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
