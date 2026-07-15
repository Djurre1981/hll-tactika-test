import { state } from "../state.js";
import {
  isPlayableDirectUrl,
  createVideoElement,
} from "../utils/video.js";
import {
  canExtractVideoFrame,
  fileFromImageSource,
  fileFromVideoFrame,
  getVideoFrameObjectUrl,
} from "../utils/video-frame.js";
import {
  getPinMediaItems,
  isDirectImageUrl,
  pinNeedsCompactStill,
} from "../helpers/pin-media.js";
import { getMediaPlayback, maybePersistHoverThumbnail } from "./preview-media.js";
import {
  getPreviewMedia,
  resolvePreviewStillUrl,
  absoluteStillUrl,
  currentPreviewStillUrl,
  renderPreviewStill,
} from "./pin-preview.js";

const PREVIEW_VIDEO_DWELL_MS = 1600;

function schedulePreviewVideo(previewPinId, playback, pinTitle, dwellMs = PREVIEW_VIDEO_DWELL_MS) {
  clearTimeout(state.previewVideoTimer);
  state.previewVideoTimer = window.setTimeout(() => {
    state.previewVideoTimer = null;
    if (state.highlightedPinId !== previewPinId) return;
    startPreviewPlayback(getPreviewMedia(), playback, pinTitle);
  }, dwellMs);
}

function startPreviewPlayback(previewMedia, { playbackUrl }, pinTitle) {
  if (!playbackUrl || !previewMedia) return;

  const still = previewMedia.querySelector("img, .preview-still-placeholder");

  if (isPlayableDirectUrl(playbackUrl)) {
    const video = createVideoElement(playbackUrl, {
      autoplay: true,
      muted: true,
      controls: false,
      preload: "metadata",
    });
    video.loop = true;
    video.classList.add("preview-video--pending");
    video.setAttribute("aria-label", `${pinTitle} preview`);
    const reveal = () => {
      video.classList.remove("preview-video--pending");
      still?.remove();
      video.play().catch(() => {
      });
    };
    video.addEventListener("loadeddata", reveal, { once: true });
    video.addEventListener("canplay", reveal, { once: true });
    previewMedia.appendChild(video);
    return;
  }

  const iframe = createVideoElement(playbackUrl, { autoplay: true, muted: true });
  iframe.classList.add("preview-video--pending");
  iframe.setAttribute("aria-label", `${pinTitle} preview`);
  let revealed = false;
  const reveal = () => {
    if (revealed || !previewMedia.contains(iframe)) return;
    revealed = true;
    clearTimeout(state.previewIframeRevealTimer);
    state.previewIframeRevealTimer = null;
    iframe.classList.remove("preview-video--pending");
    still?.remove();
  };
  iframe.addEventListener("load", reveal, { once: true });
  clearTimeout(state.previewIframeRevealTimer);
  state.previewIframeRevealTimer = window.setTimeout(reveal, 2500);
  previewMedia.appendChild(iframe);
}

async function renderPreviewPlayer(previewMedia, pin, playback, pinTitle) {
  let stillUrl = resolvePreviewStillUrl(pin, playback);
  const nextStill = absoluteStillUrl(stillUrl);
  const currentStill = absoluteStillUrl(currentPreviewStillUrl(previewMedia));
  if (nextStill && nextStill !== currentStill) {
    renderPreviewStill(previewMedia, stillUrl, pinTitle);
  } else if (!nextStill && !previewMedia.querySelector("img.preview-still")) {
    renderPreviewStill(previewMedia, stillUrl, pinTitle);
  } else if (nextStill && nextStill === currentStill) {
    previewMedia
      .querySelector("img.preview-still")
      ?.classList.remove("preview-still--loading");
  }

  if (playback.isImage) {
    const firstVideo = getPinMediaItems(pin).find((item) => item.kind === "video");
    if (!firstVideo) return;

    try {
      const videoPlayback = await getMediaPlayback(firstVideo, {
        signal: state.previewLoadAbort?.signal,
      });
      if (state.highlightedPinId !== pin.id) return;
      if (!videoPlayback.playbackUrl) return;
      schedulePreviewVideo(pin.id, videoPlayback, pinTitle, PREVIEW_VIDEO_DWELL_MS);
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("Could not resolve hover preview video", error);
    }
    return;
  }

  if (!playback.playbackUrl) {
    return;
  }

  if ((!stillUrl || pinNeedsCompactStill(pin)) && canExtractVideoFrame(playback.playbackUrl)) {
    try {
      const frameUrl = await getVideoFrameObjectUrl(playback.playbackUrl);
      if (state.highlightedPinId !== pin.id) return;
      if (!stillUrl) {
        stillUrl = frameUrl;
        renderPreviewStill(previewMedia, stillUrl, pinTitle);
      }
    } catch (error) {
      console.warn("Could not capture preview frame", error);
    }
  }

  schedulePreviewVideo(
    pin.id,
    playback,
    pinTitle,
    stillUrl ? PREVIEW_VIDEO_DWELL_MS : 0
  );

  void maybePersistHoverThumbnail(pin, stillUrl, playback);
}

export {
  schedulePreviewVideo,
  startPreviewPlayback,
  renderPreviewPlayer,
};
