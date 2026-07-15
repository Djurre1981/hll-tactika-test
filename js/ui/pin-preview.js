import { state } from "../state.js";
import { isGuideInteractionAllowed } from "../helpers/app-mode.js";
import {
  clearMediaContainer,
  createVideoElement,
  normalizeVideoUrl,
  youtubeThumbnail,
} from "../utils/video.js";
import {
  isDirectImageUrl,
  isPlatformThumbnailUrl,
  isPreviewStillUrl,
  pinNeedsCompactStill,
  getPinMediaItems,
  findMediaItemForThumbnail,
} from "../helpers/pin-media.js";
import { getRequiresDisplayConfig } from "./pin-modal.js";
import { generatePositionCode } from "../helpers/position-code.js";
import { getFactionDisplay, getPinTagLabel } from "../helpers/constants.js";
import { getMgArrowheadFocusCoords } from "./mg-spot-arrows.js";
import { isPhoneLayout } from "../helpers/layout.js";
import { openModal, armModalDismissGuard } from "./pin-modal.js";
import {
  absoluteThumbUrl,
  ensureWarmedThumbnail,
  getWarmedThumbnail,
  rememberWarmedThumbnail,
} from "../helpers/thumbnail-cache.js";
import {
  beginPreviewLoad,
  cancelPreviewTimers,
  getPinPreviewPlayback,
  getPinThumbnailMediaItem,
} from "./preview-media.js";
import { renderPreviewPlayer } from "./preview-video.js";

export function clearPreviewMedia() {
  cancelPreviewTimers();
  state.previewLoadAbort?.abort();
  state.previewLoadAbort = null;
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

const PREVIEW_DETAIL_DEBOUNCE_MS = 200;

function schedulePreviewDetailLoad(pin, previewPinId) {
  const media = getPreviewMedia();
  if (!media.querySelector("img, .preview-still-placeholder")) {
    clearMediaContainer(media);
    media.innerHTML = '<p class="preview-loading">Loading clip…</p>';
  }
  clearTimeout(state.previewDetailTimer);
  state.previewDetailTimer = window.setTimeout(() => {
    state.previewDetailTimer = null;
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

export function renderPreviewStill(previewMedia, stillUrl, pinTitle) {
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
  state.previewLoadAbort?.abort();
  state.previewLoadAbort = null;

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

export {
  getPreviewMedia,
  resolvePreviewStillUrl,
  absoluteStillUrl,
  currentPreviewStillUrl,
};
