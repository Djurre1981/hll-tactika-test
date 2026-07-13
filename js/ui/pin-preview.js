import { resolvePinDetail } from "../helpers/pin-detail-cache.js";
import { state } from "../state.js";
import {
  clearMediaContainer,
  createVideoElement,
  isMedalUrl,
  isPlayableDirectUrl,
  normalizeVideoUrl,
  youtubeThumbnail,
} from "../utils/video.js";
import { resolveMedalClip } from "../utils/medal.js";
import { getRequiresDisplayConfig } from "./pin-modal.js";
import { generatePositionCode } from "../helpers/position-code.js";
import { getFactionDisplay, getPinTagLabel } from "../helpers/constants.js";
import { detectMediaKind, getPinMediaItems, isDirectImageUrl } from "../helpers/pin-media.js";
import { getMgArrowheadFocusCoords } from "./mg-spot-arrows.js";
import { isPhoneLayout } from "../helpers/layout.js";
import { openModal, armModalDismissGuard } from "./pin-modal.js";

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
    const normalizedThumb = normalizeVideoUrl(thumb);
    const matches = items.filter(
      (item) => normalizeVideoUrl(item.url) === normalizedThumb
    );
    if (matches.length > 0) {
      const preferredKind = detectMediaKind(thumb);
      if (preferredKind) {
        const kindMatch = matches.find((item) => item.kind === preferredKind);
        if (kindMatch) return kindMatch;
      }
      return matches[0];
    }
  }

  return items[0];
}

export async function getPinPlayback(pin, mediaIndex = 0) {
  const items = getPinMediaItems(pin);
  return getMediaPlayback(items[mediaIndex]);
}

const PREVIEW_DETAIL_DEBOUNCE_MS = 200;
const PREVIEW_VIDEO_DWELL_MS = 2000;
let previewDetailTimer = null;
let previewVideoTimer = null;
let previewLoadAbort = null;

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
  if (playback?.isImage && playback.playbackUrl) {
    return playback.playbackUrl;
  }
  if (playback?.thumbnail && isDirectImageUrl(playback.thumbnail)) {
    return playback.thumbnail;
  }
  const imageItem = getPinMediaItems(pin).find(
    (item) => item.kind === "image" && isDirectImageUrl(item.url)
  );
  if (imageItem) {
    return imageItem.url;
  }
  const markerThumb = String(pin.thumbnail || "").trim();
  if (markerThumb && isDirectImageUrl(markerThumb)) {
    return markerThumb;
  }
  return null;
}

function renderPreviewStill(previewMedia, stillUrl, pinTitle) {
  clearMediaContainer(previewMedia);
  if (stillUrl) {
    const img = document.createElement("img");
    img.src = stillUrl;
    img.alt = `${pinTitle} preview`;
    previewMedia.appendChild(img);
    return;
  }
  const placeholder = document.createElement("div");
  placeholder.className = "preview-still-placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  previewMedia.appendChild(placeholder);
}

export function showPreview(pin, event) {
  if (!state.previewEnabled || state.panelMode !== null) return;

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

  if (isMarkerOnly && markerThumbnail && isDirectImageUrl(markerThumbnail)) {
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

  if (previewMediaItem.kind === "image" && isDirectImageUrl(previewMediaItem.url)) {
    renderPreviewStill(getPreviewMedia(), previewMediaItem.url, pin.title);
  } else {
    const markerStill =
      markerThumbnail && isDirectImageUrl(markerThumbnail) ? markerThumbnail : null;
    renderPreviewStill(getPreviewMedia(), markerStill, pin.title);
  }
  showPreviewTooltip();
  movePreview(event);
  schedulePreviewDetailLoad(pin, previewPinId);
}

function schedulePreviewVideo(previewPinId, playback, pinTitle) {
  clearTimeout(previewVideoTimer);
  previewVideoTimer = window.setTimeout(() => {
    previewVideoTimer = null;
    if (state.highlightedPinId !== previewPinId) return;
    startPreviewPlayback(getPreviewMedia(), playback, pinTitle);
  }, PREVIEW_VIDEO_DWELL_MS);
}

function startPreviewPlayback(previewMedia, { playbackUrl }, pinTitle) {
  if (!playbackUrl || !previewMedia) return;

  if (isPlayableDirectUrl(playbackUrl)) {
    const still = previewMedia.querySelector("img, .preview-still-placeholder");
    const video = createVideoElement(playbackUrl, {
      autoplay: true,
      muted: true,
      controls: false,
      preload: "metadata",
    });
    video.loop = true;
    video.classList.add("preview-video--pending");
    video.setAttribute("aria-label", `${pinTitle} preview`);
    video.addEventListener(
      "canplay",
      () => {
        video.classList.remove("preview-video--pending");
        still?.remove();
        video.play().catch(() => {});
      },
      { once: true }
    );
    previewMedia.appendChild(video);
    return;
  }

  clearMediaContainer(previewMedia);
  const iframe = createVideoElement(playbackUrl, { autoplay: true, muted: true });
  previewMedia.appendChild(iframe);
}

function renderPreviewPlayer(previewMedia, pin, playback, pinTitle) {
  const stillUrl = resolvePreviewStillUrl(pin, playback);
  renderPreviewStill(previewMedia, stillUrl, pinTitle);

  if (playback.isImage || !playback.playbackUrl) {
    return;
  }

  schedulePreviewVideo(pin.id, playback, pinTitle);
}

export async function loadPreviewMedia(marker, previewPinId) {
  const signal = beginPreviewLoad();
  try {
    const pin = await resolvePinDetail(state.currentMapId, marker);
    if (signal.aborted || state.highlightedPinId !== previewPinId) return;

    const playback = await getPinPreviewPlayback(pin, signal);
    if (signal.aborted || state.highlightedPinId !== previewPinId) return;

    renderPreviewPlayer(getPreviewMedia(), pin, playback, pin.title);
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
