import { useEffect, useState } from "react";
import { isPhoneLayout } from "./isPhoneLayout.js";
import {
  ACTIVATE_RETRY_MS,
  LERP_FACTOR,
  LOAD_TIMEOUT_MS,
  SEEK_THROTTLE_MS,
  SNAP_THRESHOLD,
  hasFrameData,
  hasValidDuration,
  isFullyBuffered,
  resolveSourceUrl,
} from "./videoScrubUtils.js";

export function useVideoScrub(videoRef, sourceUrl, containerRef = null) {
  const [tapToPlay, setTapToPlay] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sourceUrl) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phoneLayout = isPhoneLayout();
    const resolvedSourceUrl = resolveSourceUrl(sourceUrl);
    const gestureRoot = containerRef?.current || video.parentElement || document.body;

    let videoDuration = 0;
    let videoReady = false;
    let targetTime = 0;
    let currentDisplayTime = 0;
    let mouseX = window.innerWidth / 2;
    let animationId = null;
    let lastFrameTime = performance.now();
    let lastSeekTimestamp = 0;
    let tabHidden = false;
    let activating = false;
    let upgrading = false;
    let retryTimer = null;
    let destroyed = false;
    let blobUrl = null;
    let blobAbort = null;
    let phoneAutoplayMode = false;
    let phoneGestureRegistered = false;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.preload = "auto";

    function stopRetry() {
      if (!retryTimer) return;
      window.clearInterval(retryTimer);
      retryTimer = null;
    }

    function scheduleRetry() {
      if (retryTimer || destroyed || videoReady) return;
      retryTimer = window.setInterval(() => {
        if (destroyed || videoReady) {
          stopRetry();
          return;
        }
        void activate();
      }, ACTIVATE_RETRY_MS);
    }

    function startLoop() {
      if (animationId || reducedMotion || phoneLayout) return;
      lastFrameTime = performance.now();
      animationId = requestAnimationFrame(scrubLoop);
    }

    function stopLoop() {
      if (!animationId) return;
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    function applySeek(time) {
      if (!hasFrameData(video) || Math.abs(video.currentTime - time) <= 0.001) return;
      try {
        video.currentTime = time;
      } catch {
        // ignore seek errors while buffering
      }
    }

    function waitForEvent(okCheck, events, { allowCached = true } = {}) {
      if (allowCached && okCheck()) return Promise.resolve(true);

      return new Promise((resolve) => {
        let done = false;
        const finish = (ok) => {
          if (done) return;
          done = true;
          cleanup();
          resolve(ok);
        };

        const check = () => {
          if (okCheck()) finish(true);
        };

        const onError = () => finish(false);

        const cleanup = () => {
          window.clearTimeout(timer);
          for (const event of events) {
            video.removeEventListener(event, check);
          }
          video.removeEventListener("error", onError);
        };

        for (const event of events) {
          video.addEventListener(event, check);
        }
        video.addEventListener("error", onError);

        const timer = window.setTimeout(() => finish(okCheck()), LOAD_TIMEOUT_MS);
        check();
      });
    }

    function waitForFrameData(options) {
      return waitForEvent(() => hasFrameData(video), ["loadeddata", "canplay", "canplaythrough"], options);
    }

    function waitForMetadata(options) {
      return waitForEvent(() => hasValidDuration(video), ["loadedmetadata", "durationchange"], options);
    }

    async function paintFirstFrame() {
      if (destroyed || !hasFrameData(video)) return;
      try {
        const playPromise = video.play();
        if (playPromise) await playPromise;
        if (destroyed) return;
        if (!phoneLayout) {
          video.pause();
        }
      } catch {
        // Autoplay may be blocked; scrub/seek can still work once data is ready.
      }
    }

    async function startStreaming() {
      // Force a fresh load each activate attempt (Strict Mode remounts / stalled buffers).
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = null;
      }
      video.pause();
      video.removeAttribute("src");
      video.src = sourceUrl;
      video.load();

      const loaded = phoneLayout ? await waitForMetadata({ allowCached: false }) : await waitForFrameData({ allowCached: false });
      if (!loaded || destroyed) return false;
      if (video.src !== resolvedSourceUrl && !video.src.startsWith("blob:")) {
        // Browser may normalize absolute URL; accept either.
      }
      return true;
    }

    function removePhoneGestureListener() {
      gestureRoot.removeEventListener("pointerdown", handlePhoneGesturePlay);
      gestureRoot.removeEventListener("touchstart", handlePhoneGesturePlay);
      phoneGestureRegistered = false;
    }

    function handlePhoneGesturePlay() {
      removePhoneGestureListener();
      void tryPhoneAutoplay();
    }

    function registerPhoneGestureFallback() {
      if (destroyed || phoneGestureRegistered || phoneAutoplayMode) return;
      phoneGestureRegistered = true;
      setTapToPlay(true);
      gestureRoot.addEventListener("pointerdown", handlePhoneGesturePlay, { passive: true });
      gestureRoot.addEventListener("touchstart", handlePhoneGesturePlay, { passive: true });
    }

    async function tryPhoneAutoplay() {
      if (destroyed || phoneAutoplayMode) return true;

      video.loop = true;
      try {
        await video.play();
        if (destroyed) return false;
        phoneAutoplayMode = true;
        videoReady = true;
        setTapToPlay(false);
        removePhoneGestureListener();
        stopRetry();
        return true;
      } catch {
        if (!destroyed) registerPhoneGestureFallback();
        return false;
      }
    }

    async function upgradeToBlob() {
      if (phoneLayout || destroyed || blobUrl || upgrading || isFullyBuffered(video)) return;

      upgrading = true;
      blobAbort = new AbortController();

      try {
        const response = await fetch(sourceUrl, { signal: blobAbort.signal });
        if (!response.ok || destroyed) return;

        const data = await response.blob();
        if (destroyed) return;

        const nextBlobUrl = URL.createObjectURL(data);
        const preservedTime = video.currentTime;
        video.src = nextBlobUrl;
        video.load();

        const ready = await waitForFrameData({ allowCached: false });
        if (!ready || destroyed) {
          URL.revokeObjectURL(nextBlobUrl);
          return;
        }

        blobUrl = nextBlobUrl;
        applySeek(preservedTime);
        video.pause();
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.warn("Welcome video blob upgrade failed; streaming scrub continues.", error);
        }
      } finally {
        upgrading = false;
        blobAbort = null;
      }
    }

    async function activate() {
      if (videoReady || activating || destroyed) return;

      activating = true;
      try {
        const loaded = await startStreaming();
        if (destroyed || !loaded || !hasValidDuration(video)) {
          scheduleRetry();
          return;
        }

        videoDuration = video.duration;

        if (phoneLayout) {
          stopRetry();
          await tryPhoneAutoplay();
          return;
        }

        if (!hasFrameData(video)) {
          scheduleRetry();
          return;
        }

        updateTargetTime();
        currentDisplayTime = targetTime;

        await paintFirstFrame();
        if (destroyed) return;

        applySeek(currentDisplayTime);

        stopRetry();
        videoReady = true;
        if (!reducedMotion) startLoop();
        void upgradeToBlob();
      } finally {
        activating = false;
      }
    }

    function updateTargetTime() {
      if (videoDuration <= 0) return;
      const fraction = Math.max(0, Math.min(1, mouseX / window.innerWidth));
      targetTime = fraction * videoDuration;
    }

    function handleMouseMove(e) {
      mouseX = e.clientX;
      updateTargetTime();
    }

    function handleTouchMove(e) {
      if (e.touches.length > 0) {
        mouseX = e.touches[0].clientX;
        updateTargetTime();
      }
    }

    function handleMouseEnter(e) {
      mouseX = e.clientX;
      updateTargetTime();
    }

    function handleResize() {
      updateTargetTime();
    }

    function handleVisibility() {
      tabHidden = document.hidden;
      if (tabHidden) {
        stopLoop();
        return;
      }
      if (phoneAutoplayMode) {
        void video.play().catch(() => {});
        return;
      }
      if (videoReady && !reducedMotion) {
        startLoop();
      }
    }

    function scrubLoop(timestamp) {
      animationId = requestAnimationFrame(scrubLoop);

      if (!videoReady || videoDuration <= 0 || tabHidden || !hasFrameData(video) || phoneLayout) return;

      const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.1);
      lastFrameTime = timestamp;

      const normalizedFactor = 1 - Math.pow(1 - LERP_FACTOR, dt * 60);
      currentDisplayTime += (targetTime - currentDisplayTime) * normalizedFactor;

      if (Math.abs(targetTime - currentDisplayTime) < SNAP_THRESHOLD) {
        currentDisplayTime = targetTime;
      }
      currentDisplayTime = Math.max(0, Math.min(videoDuration, currentDisplayTime));

      if (timestamp - lastSeekTimestamp >= SEEK_THROTTLE_MS) {
        applySeek(currentDisplayTime);
        lastSeekTimestamp = timestamp;
      }
    }

    void activate();

    if (!phoneLayout) {
      document.addEventListener("mousemove", handleMouseMove, { passive: true });
      document.addEventListener("touchstart", handleTouchMove, { passive: true });
      document.addEventListener("touchmove", handleTouchMove, { passive: true });
      document.addEventListener("mouseenter", handleMouseEnter);
      window.addEventListener("resize", handleResize);
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      destroyed = true;
      stopRetry();
      stopLoop();
      removePhoneGestureListener();
      setTapToPlay(false);
      blobAbort?.abort();
      blobAbort = null;
      video.pause();
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = null;
      }
      if (!phoneLayout) {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("touchstart", handleTouchMove);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("mouseenter", handleMouseEnter);
        window.removeEventListener("resize", handleResize);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [videoRef, sourceUrl, containerRef]);

  return { tapToPlay };
}
