import { state } from "../state.js";
import { isPhoneLayout } from "../helpers/layout.js";
import { resolvePinDetail } from "../helpers/pin-detail-cache.js";
import { getPinPlayback } from "./preview-media.js";
import { hidePreviewImmediately } from "./pin-preview.js";
import { escapeHtml, safeUrlAttr } from "../helpers/sanitizer.js";
import { generatePositionCode } from "../helpers/position-code.js";
import { getFactionDisplay, getPinTagLabel } from "../helpers/constants.js";
import { createVideoElement, clearMediaContainer } from "../utils/video.js";
import { getPinMediaItems, getPinThumbnailMediaIndex } from "../helpers/pin-media.js";
import {
  armModalDismissGuard,
  cancelPendingModalClose,
  closeModal,
  handleModalCloseEvent,
} from "./modal-dismiss-guard.js";
import {
  getPinUploaderLabel,
  initModalMediaNav,
  updateModalMediaNav,
  setModalMediaFullscreenVisible,
} from "./modal-media-nav.js";

export { armModalDismissGuard, closeModal, handleModalCloseEvent, initModalMediaNav };

export const REQUIRES_ICON_CONFIG = {
  truck: { icon: "fa-solid fa-truck", label: "Transport Truck" },
  "repair-station": { icon: "fa-solid fa-screwdriver-wrench", label: "Repair Station" },
  barricade: { icon: "fa-solid fa-road-barrier", label: "Build Barricade" },
  depot: { icon: "fa-solid fa-warehouse", label: "Depot" },
};

const REQUIRES_FACTION_CONFIG = {
  axis: { icon: "fa-solid fa-archway", label: "Belgian Gate" },
  allies: { icon: "fa-solid fa-maximize", label: "Tank Hedgehog" },
};

export function getRequiresDisplayConfig(key, value, pinFaction = "neutral") {
  if (key === "faction-specific") {
    const faction = typeof value === "string" ? value : pinFaction;
    return REQUIRES_FACTION_CONFIG[faction] || null;
  }
  return REQUIRES_ICON_CONFIG[key] || null;
}

export function getModal() {
  return document.getElementById("video-modal");
}

function getModalTitle() {
  return document.getElementById("modal-title");
}

function getModalDescription() {
  return document.getElementById("modal-description");
}

function getModalUploader() {
  return document.getElementById("modal-uploader");
}

export function getModalPlayer() {
  return document.getElementById("modal-player");
}

export function getModalPlayerWrap() {
  return document.getElementById("modal-player-wrap");
}

function getModalFactionPart() {
  return document.getElementById("modal-faction-part");
}

function getModalPositionCode() {
  return document.getElementById("modal-position-code");
}

function getModalRequires() {
  return document.getElementById("modal-requires");
}

function renderModalImage(url, title) {
  const modalPlayer = getModalPlayer();
  clearMediaContainer(modalPlayer);
  const img = document.createElement("img");
  img.src = url;
  img.alt = `${title} image`;
  modalPlayer.appendChild(img);
  setModalMediaFullscreenVisible(true);
}

export async function openModal(marker) {
  hidePreviewImmediately();
  cancelPendingModalClose();
  state.modalPin = marker;
  state.modalMediaIndex = getPinThumbnailMediaIndex(marker);
  getModalTitle().textContent = marker.title;
  getModalDescription().textContent = "";

  const faction = marker.faction || "neutral";
  const factionConfig = getFactionDisplay(faction);
  const modalFactionPart = getModalFactionPart();
  if (modalFactionPart) {
    modalFactionPart.className = `video-modal__faction faction--${faction}`;
    const logoEl = document.getElementById("modal-faction-logo");
    const textEl = document.getElementById("modal-faction-text");
    if (logoEl) {
      logoEl.src = factionConfig.logo;
      logoEl.alt = factionConfig.label;
    }
    if (textEl) textEl.textContent = factionConfig.label;
    modalFactionPart.classList.remove("hidden");
  }

  const tagEl = document.getElementById("modal-tag");
  const titleSepEl = document.getElementById("modal-title-sep");
  const tagLabel = getPinTagLabel(marker.tag);
  if (tagEl) {
    tagEl.textContent = tagLabel;
    tagEl.className = `video-modal__tag video-modal__tag--${marker.tag}`;
  }
  if (titleSepEl) {
    titleSepEl.textContent = " - ";
  }

  const modalPositionCode = getModalPositionCode();
  if (modalPositionCode) {
    const posX = marker.tag === "mg-spot" && marker.dirX != null ? marker.dirX : marker.x;
    const posY = marker.tag === "mg-spot" && marker.dirY != null ? marker.dirY : marker.y;
    modalPositionCode.textContent = generatePositionCode(posX, posY);
    modalPositionCode.classList.remove("hidden");
  }

  const modalUploader = getModalUploader();
  if (modalUploader) {
    modalUploader.textContent = "";
    modalUploader.classList.add("hidden");
  }

  renderModalRequires(marker);
  updateModalMediaNav(marker);
  setModalMediaFullscreenVisible(false);

  clearMediaContainer(getModalPlayer());
  getModalPlayer().innerHTML = '<p class="preview-loading">Loading clip…</p>';
  const modal = getModal();
  modal.classList.remove("is-closing");
  armModalDismissGuard();
  if (!modal.open) {
    modal.showModal();
  }

  const markerId = marker.id;
  try {
    const pin = await resolvePinDetail(state.currentMapId, marker);
    if (state.modalPin?.id !== markerId) return;

    state.modalPin = pin;
    state.modalMediaIndex = getPinThumbnailMediaIndex(pin);
    getModalDescription().textContent = pin.description || "";

    const uploader = getPinUploaderLabel(pin);
    if (uploader && modalUploader) {
      modalUploader.textContent = `Added by ${uploader}`;
      modalUploader.classList.remove("hidden");
    }

    updateModalMediaNav(pin);
    loadModalPlayer(pin, state.modalMediaIndex);
  } catch (error) {
    console.error(error);
    if (state.modalPin?.id !== markerId) return;
    clearMediaContainer(getModalPlayer());
    getModalPlayer().innerHTML = '<p class="preview-error">Could not load pin details.</p>';
  }
}

function renderModalRequires(pin) {
  const modalRequires = getModalRequires();
  if (!modalRequires) return;
  const requires = pin.requires;
  if (!requires || Object.keys(requires).length === 0) {
    modalRequires.classList.add("hidden");
    modalRequires.innerHTML = "";
    return;
  }

  modalRequires.innerHTML = "";
  modalRequires.classList.remove("hidden");

  for (const [key, value] of Object.entries(requires)) {
    if (!value) continue;
    const config = getRequiresDisplayConfig(key, value, pin.faction || "neutral");
    if (!config) continue;
    const item = document.createElement("span");
    item.className = `video-modal__requires-item is-requires--${key}`;
    item.innerHTML = `<i class="${config.icon}" aria-hidden="true"></i> ${escapeHtml(config.label)}`;
    modalRequires.appendChild(item);
  }

  if (modalRequires.children.length === 0) {
    modalRequires.classList.add("hidden");
  }
}

export async function loadModalPlayer(pin, mediaIndex = state.modalMediaIndex) {
  const mediaItems = getPinMediaItems(pin);
  const mediaItem = mediaItems[mediaIndex];
  if (!mediaItem) {
    if (state.modalPin?.id !== pin.id) return;
    setModalMediaFullscreenVisible(false);
    clearMediaContainer(getModalPlayer());
    getModalPlayer().innerHTML = '<p class="preview-error">No media attached to this pin.</p>';
    return;
  }

  try {
    const { playbackUrl, isImage } = await getPinPlayback(pin, mediaIndex);
    if (state.modalPin?.id !== pin.id || state.modalMediaIndex !== mediaIndex) return;

    if (isImage) {
      renderModalImage(playbackUrl, pin.title);
      return;
    }

    const modalPlayer = getModalPlayer();
    clearMediaContainer(modalPlayer);
    const player = createVideoElement(playbackUrl, {
      autoplay: true,
      muted: false,
      controls: true,
      preload: "metadata",
    });
    if (player instanceof HTMLVideoElement) {
      player.setAttribute("controlsList", "nofullscreen");
    }
    modalPlayer.appendChild(player);
    setModalMediaFullscreenVisible(shouldShowModalMediaFullscreenButton(player));
  } catch (error) {
    console.warn(error);
    if (state.modalPin?.id !== pin.id || state.modalMediaIndex !== mediaIndex) return;
    setModalMediaFullscreenVisible(false);
    const fallbackUrl = mediaItem.url;
    clearMediaContainer(getModalPlayer());
    const safeHref = safeUrlAttr(fallbackUrl);
    getModalPlayer().innerHTML = `
      <p class="preview-error">Could not load clip.</p>
      ${safeHref ? `<p><a href="${safeHref}" target="_blank" rel="noopener noreferrer">Open original link</a></p>` : ""}
    `;
  }
}

function shouldShowModalMediaFullscreenButton(player) {
  if (!player) return false;
  if (player instanceof HTMLVideoElement) return true;
  if (player instanceof HTMLImageElement) return true;
  if (player.tagName === "IFRAME") return !isPhoneLayout();
  return true;
}

export function clearModalPlayer() {
  const wrap = getModalPlayerWrap();
  wrap?.classList.remove("is-phone-immersive");
  if (document.fullscreenElement === wrap) {
    try { void document.exitFullscreen(); } catch {}
  }
  clearMediaContainer(getModalPlayer());
  setModalMediaFullscreenVisible(false);
  state.modalPin = null;
  state.modalMediaIndex = 0;
}
