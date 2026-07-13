import { state } from "../state.js";
import {
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
import { detectMediaKind, getPinMediaItems } from "../helpers/pin-media.js";
import { getMgArrowheadFocusCoords } from "./mg-spot-arrows.js";

export async function getMediaPlayback(mediaItem) {
  if (!mediaItem) {
    return { playbackUrl: null, thumbnail: null, isImage: false };
  }

  if (mediaItem.kind === "image") {
    return { playbackUrl: mediaItem.url, thumbnail: mediaItem.url, isImage: true };
  }

  let playbackUrl = normalizeVideoUrl(mediaItem.url);
  let thumbnail = youtubeThumbnail(playbackUrl);

  if (isMedalUrl(mediaItem.url)) {
    const medal = await resolveMedalClip(mediaItem.url);
    playbackUrl = medal.contentUrl;
    thumbnail = thumbnail || medal.thumbnailUrl;
  }

  return { playbackUrl, thumbnail, isImage: false, sourceUrl: mediaItem.url };
}

export async function getPinPreviewPlayback(pin) {
  return getMediaPlayback(getPinThumbnailMediaItem(pin));
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

const TOOLTIP_TRANSITION_MS = 320;

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

export function showPreview(pin, event) {
  if (!state.previewEnabled || state.panelMode !== null) return;

  clearTimeout(state.previewHideTimer);

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

  const previewMediaItem = getPinThumbnailMediaItem(pin);
  if (!previewMediaItem) {
    getPreviewMedia().innerHTML = "";
    showPreviewTooltip();
    movePreview(event);
    return;
  }

  getPreviewMedia().innerHTML = '<p class="preview-loading">Loading clip…</p>';
  showPreviewTooltip();
  movePreview(event);

  const previewPinId = pin.id;
  loadPreviewMedia(pin, previewPinId);
}

function renderPreviewPlayer(previewMedia, { playbackUrl, thumbnail, isImage }, pinTitle) {
  previewMedia.innerHTML = "";

  if (isImage) {
    const img = document.createElement("img");
    img.src = playbackUrl;
    img.alt = `${pinTitle} preview`;
    previewMedia.appendChild(img);
    return;
  }

  if (playbackUrl) {
    if (isPlayableDirectUrl(playbackUrl)) {
      const video = createVideoElement(playbackUrl, {
        autoplay: true,
        muted: true,
        controls: false,
      });
      video.loop = true;
      video.preload = "auto";
      video.addEventListener(
        "canplay",
        () => {
          video.play().catch(() => {});
        },
        { once: true }
      );
      previewMedia.appendChild(video);
      return;
    }

    const iframe = createVideoElement(playbackUrl, { autoplay: true, muted: true });
    previewMedia.appendChild(iframe);
    return;
  }

  if (thumbnail) {
    const img = document.createElement("img");
    img.src = thumbnail;
    img.alt = `${pinTitle} preview`;
    previewMedia.appendChild(img);
  }
}

export async function loadPreviewMedia(pin, previewPinId) {
  try {
    const playback = await getPinPreviewPlayback(pin);
    if (state.highlightedPinId !== previewPinId) return;

    renderPreviewPlayer(getPreviewMedia(), playback, pin.title);
  } catch (error) {
    console.warn(error);
    if (state.highlightedPinId !== previewPinId) return;
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
    state.previewHideTimer = setTimeout(() => {
      if (!getPreviewTooltip()?.classList.contains("is-visible")) {
        getPreviewMedia().innerHTML = "";
      }
    }, TOOLTIP_TRANSITION_MS);
  }, 120);
}

export function hidePreviewImmediately() {
  clearTimeout(state.previewHideTimer);
  hidePreviewTooltip();
  getPreviewMedia().innerHTML = "";
}
