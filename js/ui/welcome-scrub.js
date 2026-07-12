const LERP_FACTOR = 0.12;
const SNAP_THRESHOLD = 0.001;
const SEEK_THROTTLE_MS = 30;
const ACTIVATE_RETRY_MS = 500;
const LOAD_TIMEOUT_MS = 15000;
const DEFAULT_VIDEO_SRC = "assets/welcome/welcome.mp4";

function resolveSourceUrl(sourceUrl) {
  return new URL(sourceUrl, window.location.href).href;
}

export function initWelcomeScrub(video) {
  if (!video) return { destroy() {} };
  if (video.__welcomeScrub) return video.__welcomeScrub;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sourceUrl = video.dataset.src || DEFAULT_VIDEO_SRC;
  const resolvedSourceUrl = resolveSourceUrl(sourceUrl);

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

  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  function hasValidDuration() {
    return Number.isFinite(video.duration) && video.duration > 0;
  }

  function hasFrameData() {
    return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }

  function isFullyBuffered() {
    if (!hasValidDuration()) return false;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= 0.05 && video.buffered.end(i) >= video.duration - 0.05) {
        return true;
      }
    }
    return false;
  }

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
    if (animationId || reducedMotion) return;
    lastFrameTime = performance.now();
    animationId = requestAnimationFrame(scrubLoop);
  }

  function stopLoop() {
    if (!animationId) return;
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  function applySeek(time) {
    if (!hasFrameData() || Math.abs(video.currentTime - time) <= 0.001) return;
    try {
      video.currentTime = time;
    } catch {
      // ignore seek errors while buffering
    }
  }

  function waitForFrameData({ allowCached = true } = {}) {
    if (allowCached && hasFrameData()) return Promise.resolve(true);

    return new Promise((resolve) => {
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        cleanup();
        resolve(ok);
      };

      const check = () => {
        if (hasFrameData()) finish(true);
      };

      const cleanup = () => {
        window.clearTimeout(timer);
        video.removeEventListener("loadeddata", check);
        video.removeEventListener("canplay", check);
        video.removeEventListener("error", onError);
      };

      const onError = () => finish(false);

      video.addEventListener("loadeddata", check);
      video.addEventListener("canplay", check);
      video.addEventListener("error", onError);

      const timer = window.setTimeout(() => finish(hasFrameData()), LOAD_TIMEOUT_MS);
      check();
    });
  }

  async function startStreaming() {
    if (video.src !== resolvedSourceUrl) {
      video.src = sourceUrl;
    }
    return waitForFrameData();
  }

  async function upgradeToBlob() {
    if (destroyed || blobUrl || upgrading || isFullyBuffered()) return;

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
      if (destroyed || !loaded || !hasValidDuration() || !hasFrameData()) {
        scheduleRetry();
        return;
      }

      videoDuration = video.duration;
      updateTargetTime();
      currentDisplayTime = targetTime;

      video.pause();
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
    } else if (videoReady && !reducedMotion) {
      startLoop();
    }
  }

  function scrubLoop(timestamp) {
    animationId = requestAnimationFrame(scrubLoop);

    if (!videoReady || videoDuration <= 0 || tabHidden || !hasFrameData()) return;

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

  document.addEventListener("mousemove", handleMouseMove, { passive: true });
  document.addEventListener("touchstart", handleTouchMove, { passive: true });
  document.addEventListener("touchmove", handleTouchMove, { passive: true });
  document.addEventListener("mouseenter", handleMouseEnter);
  window.addEventListener("resize", handleResize);
  document.addEventListener("visibilitychange", handleVisibility);

  const controller = {
    get isReady() {
      return videoReady && hasFrameData();
    },
    destroy() {
      destroyed = true;
      stopRetry();
      stopLoop();
      blobAbort?.abort();
      blobAbort = null;
      video.pause();
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = null;
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("touchstart", handleTouchMove);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("mouseenter", handleMouseEnter);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      delete video.__welcomeScrub;
    },
  };

  video.__welcomeScrub = controller;
  return controller;
}
