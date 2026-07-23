import { useCallback, useEffect, useRef, useState } from "react";

const IDLE_MS = 3200;

/**
 * Fullscreen slide-deck presentation: keyboard nav, optional laser pointer, idle chrome hide.
 */
export function useStratPresentation({
  enabled,
  slideCount,
  activeIndex,
  onSelectIndex,
  onExit,
  shellRef,
}) {
  const [laserOn, setLaserOn] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [laserPos, setLaserPos] = useState(null);
  const idleTimer = useRef(null);

  const bumpChrome = useCallback(() => {
    setChromeVisible(true);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      setChromeVisible(false);
    }, IDLE_MS);
  }, []);

  const goToIndex = useCallback(
    (index) => {
      if (index < 0 || index >= slideCount || index === activeIndex) return;
      onSelectIndex?.(index);
    },
    [activeIndex, onSelectIndex, slideCount]
  );

  const goNext = useCallback(() => {
    goToIndex(activeIndex + 1);
  }, [activeIndex, goToIndex]);

  const goPrev = useCallback(() => {
    goToIndex(activeIndex - 1);
  }, [activeIndex, goToIndex]);

  const exitPresentation = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    onExit?.();
  }, [onExit]);

  useEffect(() => {
    if (!enabled) {
      setLaserPos(null);
      setNotesOpen(false);
      setChromeVisible(true);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      return undefined;
    }

    bumpChrome();
    const shell = shellRef?.current;
    shell?.requestFullscreen?.().catch(() => {});

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        exitPresentation();
        return;
      }
      if (event.key === "ArrowRight" || event.key === " " || event.key === "PageDown") {
        event.preventDefault();
        goNext();
        bumpChrome();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goPrev();
        bumpChrome();
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        goToIndex(0);
        bumpChrome();
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        goToIndex(slideCount - 1);
        bumpChrome();
      }
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement && enabled) onExit?.();
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [
    bumpChrome,
    enabled,
    exitPresentation,
    goNext,
    goPrev,
    goToIndex,
    onExit,
    shellRef,
    slideCount,
  ]);

  const onPointerMove = useCallback(
    (event) => {
      if (!enabled) return;
      bumpChrome();
      if (!laserOn) {
        setLaserPos(null);
        return;
      }
      setLaserPos({ x: event.clientX, y: event.clientY });
    },
    [bumpChrome, enabled, laserOn]
  );

  const onPointerLeave = useCallback(() => {
    setLaserPos(null);
  }, []);

  return {
    laserOn,
    setLaserOn,
    notesOpen,
    setNotesOpen,
    chromeVisible,
    laserPos,
    goNext,
    goPrev,
    exitPresentation,
    onPointerMove,
    onPointerLeave,
    canGoPrev: activeIndex > 0,
    canGoNext: activeIndex < slideCount - 1,
  };
}
