import { resolvePinDetail, cachePinDetail, getCachedPinDetail } from "../helpers/pin-detail-cache.js";
import { state } from "../state.js";
import { isGuideInteractionAllowed } from "../helpers/app-mode.js";
import {
  clearMediaContainer,
  createVideoElement,
  isMedalUrl,
  isPlayableDirectUrl,
  normalizeVideoUrl,
  youtubeThumbnail,
} from "../utils/video.js";
import { resolveMedalClip } from "../utils/medal.js";
import {
  canExtractVideoFrame,
  fileFromImageSource,
  fileFromVideoFrame,
  getVideoFrameObjectUrl,
} from "../utils/video-frame.js";
import { fillPinThumbnail, fillPinThumbnailUrl } from "../api/pins.js";
import { getRequiresDisplayConfig } from "./pin-modal.js";
import { generatePositionCode } from "../helpers/position-code.js";
import { getFactionDisplay, getPinTagLabel } from "../helpers/constants.js";
import {
  findMediaItemForThumbnail,
  getPinMediaItems,
  isDirectImageUrl,
  isPlatformThumbnailUrl,
  isPreviewStillUrl,
  pinNeedsCompactStill,
} from "../helpers/pin-media.js";
import { getMgArrowheadFocusCoords } from "./mg-spot-arrows.js";
import { isPhoneLayout } from "../helpers/layout.js";
import { openModal, armModalDismissGuard } from "./pin-modal.js";
import {
  absoluteThumbUrl,
  ensureWarmedThumbnail,
  getWarmedThumbnail,
  rememberWarmedThumbnail,
} from "../helpers/thumbnail-cache.js";

export async function getMediaPlayback(mediaItem, { signal } = {}) {
  if (!mediaItem) {
    return { playbackUrl: null, thumbnail: null, isImage: false };
  }

  if (mediaItem.kind === "image") {
    return { playbackUrl: mediaItem.url, thumbnail: mediaItem.url, isImage: true };
  }

  let playbackUrl = normalizeVideoUrl(mediaItem.url);
  let thumbnail = youtubeThumbnail(playbackUrl);

  if (isMedalUrl(mediaItem.url)) {
    const medal = await resolveMedalClip(mediaItem.url, { signal });
    playbackUrl = medal.contentUrl;
    thumbnail = thumbnail || medal.thumbnailUrl;
  }

  return { playbackUrl, thumbnail, isImage: false, sourceUrl: mediaItem.url };
}

export async function getPinPreviewPlayback(pin, signal) {
  return getMediaPlayback(getPinThumbnailMediaItem(pin), { signal });
}

export function getPinThumbnailMediaItem(pin) {
  const items = getPinMediaItems(pin);
  if (!items.length) return null;

  const thumb = String(pin.thumbnail || "").trim();
  if (thumb) {
    const owner = findMediaItemForThumbnail(items, thumb);
    if (owner) return owner;
  }

  return items[0];
}

export async function getPinPlayback(pin, mediaIndex = 0) {
  const items = getPinMediaItems(pin);
  return getMediaPlayback(items[mediaIndex]);
}

const PREVIEW_DETAIL_DEBOUNCE_MS = 200;
const PREVIEW_VIDEO_DWELL_MS = 1600;
let previewDetailTimer = null;
let previewVideoTimer = null;
let previewIframeRevealTimer = null;
let previewLoadAbort = null;
/** @type {Set<string>} */
const thumbnailPersistInflight = new Set();

function beginPreviewLoad() {
  previewLoadAbort?.abort();
  previewLoadAbort = new AbortController();
  return previewLoadAbort.signal;
}

function cancelPreviewTimers() {
  clearTimeout(previewDetailTimer);
  previewDetailTimer = null;
  clearTimeout(previewVideoTimer);
  previewVideoTimer = null;
  clearTimeout(previewIframeRevealTimer);
  previewIframeRevealTimer = null;
}

function patchLocalPinThumbnail(mapId, pinId, thumbnail) {
  const thumb = String(thumbnail || "").trim();
  if (!mapId || !pinId || !thumb) return;

  const catalog = state.pinCatalog[mapId];
  if (Array.isArray(catalog)) {
    const marker = catalog.find((item) => item.id === pinId);
    if (marker) marker.thumbnail = thumb;
  }

  const live = state.pins.find((item) => item.id === pinId);
  if (live) live.thumbnail = thumb;

  const cached = getCachedPinDetail(mapId, pinId);
  if (cached) {
    cachePinDetail(mapId, pinId, { ...cached, thumbnail: thumb });
  }

  void ensureWarmedThumbnail(mapId, thumb);
}

/**
 * Fill-if-empty compact pin.thumbnail after hover resolves a still.
 * Updates local markers immediately so later hovers / warm picks it up.
 */
async function maybePersistHoverThumbnail(pin, stillUrl, playback) {
  if (!pin?.id || !pinNeedsCompactStill(pin)) return;
  const mapId = state.currentMapId;
  if (!mapId) return;

  const key = `${mapId}:${pin.id}`;
  if (thumbnailPersistInflight.has(key)) return;
  thumbnailPersistInflight.add(key);

  try {
    const platformStill =
      (stillUrl && isPlatformThumbnailUrl(stillUrl) && String(stillUrl).trim()) ||
      (playback?.thumbnail &&
        isPlatformThumbnailUrl(playback.thumbnail) &&
        String(playback.thumbnail).trim()) ||
      "";

    let result = null;
    if (platformStill) {
      patchLocalPinThumbnail(mapId, pin.id, platformStill);
      result = await fillPinThumbnailUrl(mapId, pin.id, platformStill);
    } else if (playback?.playbackUrl && canExtractVideoFrame(playback.playbackUrl)) {
      const file = await fileFromVideoFrame(playback.playbackUrl, "preview.jpg");
      result = await fillPinThumbnail(mapId, pin.id, file);
    } else {
      const imageItem = getPinMediaItems(pin).find(
        (item) => item.kind === "image" && isDirectImageUrl(item.url)
      );
      if (!imageItem) return;
      const file = await fileFromImageSource(imageItem.url, "preview.jpg");
      result = await fillPinThumbnail(mapId, pin.id, file);
    }

    const saved = String(result?.thumbnail || "").trim();
    if (saved) {
      patchLocalPinThumbnail(mapId, pin.id, saved);
    }
  } catch (error) {
    console.warn("Hover thumbnail persist skipped", error);
  } finally {
    thumbnailPersistInflight.delete(key);
  }
}

function clearPreviewMedia() {
  cancelPreviewTimers();
  previewLoadAbort?.abort();
  previewLoadAbort = null;
  clearMediaContainer(getPreviewMedia());
}

function getPreviewTooltip() {
  return document.getElementById("preview-tooltip");
}

function showPreviewTooltip() {
  getPreviewTooltip()?.classList.add("is-visible");
}

function hidePreviewTooltip() {
  getPreviewTooltip()?.classList.remove("is-visible");
}

function getPreviewMedia() {
  return document.getElementById("preview-media");
}

function getPreviewTitle() {
  return document.getElementById("preview-title");
}

function getPreviewPositionCode() {
  return document.getElementById("preview-position-code");
}

function getPreviewFactionPart() {
  return document.getElementById("preview-faction-part");
}

function getPreviewFactionText() {
  return document.getElementById("preview-faction-text");
}

function getPreviewRequires() {
  return document.getElementById("preview-requires");
}

function renderPreviewRequires(pin) {
  const previewRequires = getPreviewRequires();
  if (!previewRequires) return;
  previewRequires.innerHTML = "";
  const requires = pin.requires;
  if (!requires || Object.keys(requires).length === 0) return;

  for (const [key, value] of Object.entries(requires)) {
    if (!value) continue;
    const config = getRequiresDisplayConfig(key, value, pin.faction || "neutral");
    if (!config) continue;
    const item = document.createElement("span");
    item.className = `preview-tooltip__requires-item is-requires--${key}`;
    item.innerHTML = `<i class="${config.icon}" aria-hidden="true"></i>`;
    item.title = config.label;
    previewRequires.appendChild(item);
  }
}

function schedulePreviewDetailLoad(pin, previewPinId) {
  const media = getPreviewMedia();
  if (!media.querySelector("img, .preview-still-placeholder")) {
    clearMediaContainer(media);
    media.innerHTML = '<p class="preview-loading">Loading clip…</p>';
  }
  clearTimeout(previewDetailTimer);
  previewDetailTimer = window.setTimeout(() => {
    previewDetailTimer = null;
    loadPreviewMedia(pin, previewPinId);
  }, PREVIEW_DETAIL_DEBOUNCE_MS);
}

function resolvePreviewStillUrl(pin, playback) {
  const markerThumb = String(pin.thumbnail || "").trim();
  if (markerThumb && isPreviewStillUrl(markerThumb) && !pinNeedsCompactStill(pin)) {
    return markerThumb;
  }
  if (playback?.thumbnail && isPlatformThumbnailUrl(playback.thumbnail)) {
    return playback.thumbnail;
  }
  if (playback?.isImage && playback.playbackUrl) {
    return playback.playbackUrl;
  }
  if (playback?.thumbnail && isPreviewStillUrl(playback.thumbnail)) {
    return playback.thumbnail;
  }
  const imageItem = getPinMediaItems(pin).find(
    (item) => item.kind === "image" && isDirectImageUrl(item.url)
  );
  if (imageItem) {
    return imageItem.url;
  }
  if (markerThumb && isPreviewStillUrl(markerThumb)) {
    return markerThumb;
  }
  return null;
}

function absoluteStillUrl(url) {
  return absoluteThumbUrl(url);
}

function currentPreviewStillUrl(previewMedia) {
  const img = previewMedia?.querySelector("img.preview-still");
  if (!img) return "";
  return absoluteStillUrl(img.dataset.thumbUrl || img.currentSrc || img.src);
}

function renderPreviewStill(previewMedia, stillUrl, pinTitle) {
  if (!previewMedia) return;

  const nextUrl = absoluteStillUrl(stillUrl);
  if (!nextUrl) {
    const hasPlaceholder = previewMedia.querySelector(".preview-still-placeholder");
    if (hasPlaceholder && !previewMedia.querySelector("img, video, iframe")) return;
    clearMediaContainer(previewMedia);
    const placeholder = document.createElement("div");
    placeholder.className = "preview-still-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    previewMedia.appendChild(placeholder);
    return;
  }

  const existing = previewMedia.querySelector("img.preview-still");
  if (existing && currentPreviewStillUrl(previewMedia) === nextUrl) {
    existing.alt = `${pinTitle} preview`;
    if (existing.complete && existing.naturalWidth > 0) {
      existing.classList.remove("preview-still--loading");
    }
    previewMedia.querySelectorAll("video, iframe").forEach((el) => el.remove());
    return;
  }

  clearMediaContainer(previewMedia);

  const warmed = getWarmedThumbnail(state.currentMapId, nextUrl);
  if (warmed?.img?.complete && warmed.img.naturalWidth > 0) {
    // Paint from the in-memory blob/CDN warm entry — no network, tiny decode.
    const img = document.createElement("img");
    img.className = "preview-still";
    img.alt = `${pinTitle} preview`;
    img.dataset.thumbUrl = nextUrl;
    img.decoding = "sync";
    img.src = warmed.displayUrl;
    previewMedia.appendChild(img);
    return;
  }

  const img = document.createElement("img");
  img.className = "preview-still preview-still--loading";
  img.alt = `${pinTitle} preview`;
  img.dataset.thumbUrl = nextUrl;
  img.decoding = "async";

  const reveal = () => {
    img.classList.remove("preview-still--loading");
    rememberWarmedThumbnail(state.currentMapId, nextUrl);
  };
  if (img.decode) {
    img.addEventListener(
      "load",
      () => {
        img.decode().then(reveal).catch(reveal);
      },
      { once: true }
    );
  } else {
    img.addEventListener("load", reveal, { once: true });
  }
  img.addEventListener("error", () => img.classList.remove("preview-still--loading"), {
    once: true,
  });
  img.src = nextUrl;
  if (img.complete && img.naturalWidth > 0) {
    reveal();
  }
  previewMedia.appendChild(img);

  // Dense maps may still be warming — swap to blob/CDN warm entry when ready.
  if (!nextUrl.startsWith("blob:")) {
    void ensureWarmedThumbnail(state.currentMapId, nextUrl).then((entry) => {
      if (!entry?.displayUrl) return;
      const current = previewMedia.querySelector("img.preview-still");
      if (!current || current.dataset.thumbUrl !== nextUrl) return;
      if (current.getAttribute("src") === entry.displayUrl) {
        current.classList.remove("preview-still--loading");
        return;
      }
      current.src = entry.displayUrl;
      current.classList.remove("preview-still--loading");
    });
  }
}

export function showPreview(pin, event) {
  if (!state.previewEnabled || !isGuideInteractionAllowed() || state.panelMode !== null) return;

  clearTimeout(state.previewHideTimer);
  cancelPreviewTimers();
  previewLoadAbort?.abort();
  previewLoadAbort = null;

  const faction = pin.faction || "neutral";
  const factionConfig = getFactionDisplay(faction);

  const previewFactionPart = getPreviewFactionPart();
  if (previewFactionPart) {
    previewFactionPart.className = `preview-tooltip__faction faction--${faction}`;
    const logoEl = document.getElementById("preview-faction-logo");
    const previewFactionText = getPreviewFactionText();
    if (logoEl) {
      logoEl.src = factionConfig.logo;
      logoEl.alt = factionConfig.label;
    }
    if (previewFactionText) previewFactionText.textContent = factionConfig.label;
    previewFactionPart.classList.remove("hidden");
  }

  const tagEl = document.getElementById("preview-tag");
  const tagLabel = getPinTagLabel(pin.tag);
  if (tagEl) {
    tagEl.textContent = tagLabel;
    tagEl.className = `preview-tooltip__tag preview-tooltip__tag--${pin.tag}`;
  }

  getPreviewTitle().textContent = pin.title;

  const previewPositionCode = getPreviewPositionCode();
  if (previewPositionCode) {
    const posX = pin.tag === "mg-spot" && pin.dirX != null ? pin.dirX : pin.x;
    const posY = pin.tag === "mg-spot" && pin.dirY != null ? pin.dirY : pin.y;
    previewPositionCode.textContent = generatePositionCode(posX, posY);
    previewPositionCode.classList.remove("hidden");
  }

  renderPreviewRequires(pin);

  const previewPinId = pin.id;
  const markerThumbnail = String(pin.thumbnail || "").trim();
  const isMarkerOnly =
    !pin.videoUrl && !(Array.isArray(pin.mediaItems) && pin.mediaItems.length > 0);

  if (isMarkerOnly && markerThumbnail && isPreviewStillUrl(markerThumbnail)) {
    renderPreviewStill(getPreviewMedia(), markerThumbnail, pin.title);
    showPreviewTooltip();
    movePreview(event);
    schedulePreviewDetailLoad(pin, previewPinId);
    return;
  }

  if (isMarkerOnly && (pin.hasMedia || markerThumbnail)) {
    renderPreviewStill(getPreviewMedia(), null, pin.title);
    showPreviewTooltip();
    movePreview(event);
    schedulePreviewDetailLoad(pin, previewPinId);
    return;
  }

  const previewMediaItem = getPinThumbnailMediaItem(pin);
  if (!previewMediaItem) {
    clearPreviewMedia();
    showPreviewTooltip();
    movePreview(event);
    return;
  }

  const markerStill =
    markerThumbnail && isPreviewStillUrl(markerThumbnail) ? markerThumbnail : null;
  if (previewMediaItem.kind === "image" && isDirectImageUrl(previewMediaItem.url)) {
    renderPreviewStill(
      getPreviewMedia(),
      markerStill && !pinNeedsCompactStill(pin) ? markerStill : previewMediaItem.url,
      pin.title
    );
  } else {
    renderPreviewStill(getPreviewMedia(), markerStill, pin.title);
  }
  showPreviewTooltip();
  movePreview(event);
  schedulePreviewDetailLoad(pin, previewPinId);
}

function schedulePreviewVideo(previewPinId, playback, pinTitle, dwellMs = PREVIEW_VIDEO_DWELL_MS) {
  clearTimeout(previewVideoTimer);
  previewVideoTimer = window.setTimeout(() => {
    previewVideoTimer = null;
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
        /* autoplay blocked — expect user gesture */
      });
    };
    video.addEventListener("loadeddata", reveal, { once: true });
    video.addEventListener("canplay", reveal, { once: true });
    previewMedia.appendChild(video);
    return;
  }

  // Keep the still visible under the embed until it paints (YouTube/Medal iframe).
  const iframe = createVideoElement(playbackUrl, { autoplay: true, muted: true });
  iframe.classList.add("preview-video--pending");
  iframe.setAttribute("aria-label", `${pinTitle} preview`);
  let revealed = false;
  const reveal = () => {
    if (revealed || !previewMedia.contains(iframe)) return;
    revealed = true;
    clearTimeout(previewIframeRevealTimer);
    previewIframeRevealTimer = null;
    iframe.classList.remove("preview-video--pending");
    still?.remove();
  };
  iframe.addEventListener("load", reveal, { once: true });
  // Embeds can sit on load forever; don't leave thumb forever if reveal never fires.
  clearTimeout(previewIframeRevealTimer);
  previewIframeRevealTimer = window.setTimeout(reveal, 2500);
  previewMedia.appendChild(iframe);
}

async function renderPreviewPlayer(previewMedia, pin, playback, pinTitle) {
  let stillUrl = resolvePreviewStillUrl(pin, playback);
  const nextStill = absoluteStillUrl(stillUrl);
  const currentStill = absoluteStillUrl(currentPreviewStillUrl(previewMedia));
  // Avoid clearing a painted warm still while pin detail resolves.
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

export async function loadPreviewMedia(marker, previewPinId) {
  const signal = beginPreviewLoad();
  try {
    const pin = await resolvePinDetail(state.currentMapId, marker);
    if (signal.aborted || state.highlightedPinId !== previewPinId) return;

    const playback = await getPinPreviewPlayback(pin, signal);
    if (signal.aborted || state.highlightedPinId !== previewPinId) return;

    await renderPreviewPlayer(getPreviewMedia(), pin, playback, pin.title);
  } catch (error) {
    if (signal.aborted || error?.name === "AbortError") return;
    console.warn(error);
    if (state.highlightedPinId !== previewPinId) return;
    clearMediaContainer(getPreviewMedia());
    getPreviewMedia().innerHTML =
      '<p class="preview-error">Could not load preview. Click the pin to open the clip.</p>';
  }
}

export function isPreviewVisible() {
  return getPreviewTooltip()?.classList.contains("is-visible") ?? false;
}

export function showPreviewAtPin(pin) {
  const viewport = document.getElementById("map-viewport");
  const rect = viewport?.getBoundingClientRect();
  let clientX = window.innerWidth / 2;
  let clientY = window.innerHeight / 2;

  if (state.mapViewer && rect) {
    const coords =
      pin.tag === "mg-spot" ? getMgArrowheadFocusCoords(pin) : { x: pin.x, y: pin.y };
    const screen = state.mapViewer.mapPercentToScreen(coords.x, coords.y);
    clientX = rect.left + screen.x;
    clientY = rect.top + screen.y;
  }

  showPreview(pin, { clientX, clientY });
}

export function movePreview(event) {
  const offset = 16;
  const tooltip = getPreviewTooltip();
  const width = tooltip.offsetWidth || 320;
  const height = tooltip.offsetHeight || 220;

  let x = event.clientX + offset;
  let y = event.clientY + offset;

  if (x + width > window.innerWidth - 12) {
    x = event.clientX - width - offset;
  }
  if (y + height > window.innerHeight - 12) {
    y = event.clientY - height - offset;
  }

  tooltip.style.left = `${Math.max(12, x)}px`;
  tooltip.style.top = `${Math.max(12, y)}px`;
}

export function scheduleHidePreview() {
  clearTimeout(state.previewHideTimer);
  state.previewHideTimer = setTimeout(() => {
    hidePreviewTooltip();
    // Stop downloads immediately; do not wait for tooltip fade.
    clearPreviewMedia();
  }, 120);
}

export function hidePreviewImmediately() {
  clearTimeout(state.previewHideTimer);
  state.phonePreviewPinId = null;
  hidePreviewTooltip();
  clearPreviewMedia();
}

export function initPreviewTooltip() {
  const body = document.querySelector(".preview-tooltip__body");
  if (!body || body.dataset.previewBound === "true") return;
  body.dataset.previewBound = "true";

  body.addEventListener("pointerdown", (event) => {
    if (!isPhoneLayout() || state.panelMode !== null || !isPreviewVisible()) return;
    if (event.button !== 0) return;
    armModalDismissGuard();
  });

  body.addEventListener("click", (event) => {
    if (!isPhoneLayout() || state.panelMode !== null || !isPreviewVisible()) return;

    const pinId = state.phonePreviewPinId || state.highlightedPinId;
    if (!pinId) return;

    const pin = state.pins.find((item) => item.id === pinId);
    if (!pin) return;

    event.stopPropagation();
    state.phonePreviewPinId = null;
    openModal(pin);
  });
}
