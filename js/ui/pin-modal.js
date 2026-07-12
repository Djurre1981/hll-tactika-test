import { state } from "../state.js";
import { getPinPlayback } from "./pin-preview.js";
import { hidePreviewImmediately } from "./pin-preview.js";
import { escapeHtml } from "../helpers/sanitizer.js";
import { generatePositionCode } from "../helpers/position-code.js";
import { getFactionDisplay, getPinTagLabel } from "../helpers/constants.js";
import { createVideoElement } from "../utils/video.js";
import { getPinMediaItems } from "../helpers/pin-media.js";

export const REQUIRES_ICON_CONFIG = {
  truck: { icon: "fa-solid fa-truck", label: "Transport Truck" },
  "repair-station": { icon: "fa-solid fa-screwdriver-wrench", label: "Repair Station" },
  barricade: { icon: "fa-solid fa-road-barrier", label: "Build Barricade" },
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

function getModal() {
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

function getModalPlayer() {
  return document.getElementById("modal-player");
}

function getModalPlayerWrap() {
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

function getModalMediaPrev() {
  return document.getElementById("modal-media-prev");
}

function getModalMediaNext() {
  return document.getElementById("modal-media-next");
}

function getModalMediaCounter() {
  return document.getElementById("modal-media-counter");
}

function getModalMediaFullscreen() {
  return document.getElementById("modal-media-fullscreen");
}

function modalStageHasMedia() {
  return Boolean(getModalPlayer()?.querySelector("img, video, iframe"));
}

function isModalStageFullscreen() {
  return document.fullscreenElement === getModalPlayerWrap();
}

function getPinUploaderLabel(pin) {
  if (!pin?.createdBy) {
    return null;
  }
  return pin.createdByName || `Steam user ${pin.createdBy}`;
}

function updateModalMediaNav(pin) {
  const items = getPinMediaItems(pin);
  const showNav = items.length > 1;
  const index = state.modalMediaIndex;

  getModalMediaPrev()?.classList.toggle("hidden", !showNav);
  getModalMediaNext()?.classList.toggle("hidden", !showNav);

  const counter = getModalMediaCounter();
  if (counter) {
    counter.classList.toggle("hidden", !showNav);
    counter.textContent = showNav ? `${index + 1} / ${items.length}` : "";
  }
}

function syncModalMediaFullscreenButton() {
  const button = getModalMediaFullscreen();
  if (!button) return;

  const icon = button.querySelector(".video-modal__fullscreen-icon");
  const isFullscreen = isModalStageFullscreen();
  button.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
  if (icon) {
    icon.classList.toggle("fa-expand", !isFullscreen);
    icon.classList.toggle("fa-compress", isFullscreen);
  }
}

function setModalMediaFullscreenVisible(visible) {
  getModalMediaFullscreen()?.classList.toggle("hidden", !visible);
  if (!visible) {
    void exitModalMediaFullscreen();
  } else {
    syncModalMediaFullscreenButton();
  }
}

async function exitModalMediaFullscreen() {
  if (isModalStageFullscreen()) {
    try {
      await document.exitFullscreen();
    } catch {
      // Ignore if the browser already exited fullscreen.
    }
  }
  syncModalMediaFullscreenButton();
}

async function toggleModalMediaFullscreen() {
  const wrap = getModalPlayerWrap();
  if (!wrap || !modalStageHasMedia()) return;

  try {
    if (isModalStageFullscreen()) {
      await document.exitFullscreen();
    } else {
      await wrap.requestFullscreen();
    }
  } catch (error) {
    console.warn(error);
  }
  syncModalMediaFullscreenButton();
}

function renderModalImage(url, title) {
  const modalPlayer = getModalPlayer();
  modalPlayer.innerHTML = "";
  const img = document.createElement("img");
  img.src = url;
  img.alt = `${title} image`;
  modalPlayer.appendChild(img);
  setModalMediaFullscreenVisible(true);
}

export function openModal(pin) {
  hidePreviewImmediately();
  cancelPendingModalClose();
  state.modalPin = pin;
  state.modalMediaIndex = 0;
  getModalTitle().textContent = pin.title;
  getModalDescription().textContent = pin.description || "";

  const faction = pin.faction || "neutral";
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
  const tagLabel = getPinTagLabel(pin.tag);
  if (tagEl) {
    tagEl.textContent = tagLabel;
    tagEl.className = `video-modal__tag video-modal__tag--${pin.tag}`;
  }
  if (titleSepEl) {
    titleSepEl.textContent = " - ";
  }

  const modalPositionCode = getModalPositionCode();
  if (modalPositionCode) {
    const posX = pin.tag === "mg-spot" && pin.dirX != null ? pin.dirX : pin.x;
    const posY = pin.tag === "mg-spot" && pin.dirY != null ? pin.dirY : pin.y;
    modalPositionCode.textContent = generatePositionCode(posX, posY);
    modalPositionCode.classList.remove("hidden");
  }

  const uploader = getPinUploaderLabel(pin);
  const modalUploader = getModalUploader();
  if (uploader && modalUploader) {
    modalUploader.textContent = `Added by ${uploader}`;
    modalUploader.classList.remove("hidden");
  } else if (modalUploader) {
    modalUploader.textContent = "";
    modalUploader.classList.add("hidden");
  }

  renderModalRequires(pin);
  updateModalMediaNav(pin);
  setModalMediaFullscreenVisible(false);

  getModalPlayer().innerHTML = '<p class="preview-loading">Loading clip…</p>';
  const modal = getModal();
  modal.classList.remove("is-closing");
  armModalDismissGuard();
  loadModalPlayer(pin, state.modalMediaIndex);
  if (!modal.open) {
    modal.showModal();
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
    modalPlayer.innerHTML = "";
    const player = createVideoElement(playbackUrl, {
      autoplay: true,
      muted: false,
      controls: true,
    });
    if (player instanceof HTMLVideoElement) {
      player.setAttribute("controlsList", "nofullscreen");
    }
    modalPlayer.appendChild(player);
    setModalMediaFullscreenVisible(true);
  } catch (error) {
    console.warn(error);
    if (state.modalPin?.id !== pin.id || state.modalMediaIndex !== mediaIndex) return;
    setModalMediaFullscreenVisible(false);
    const fallbackUrl = mediaItem.url;
    getModalPlayer().innerHTML = `
      <p class="preview-error">Could not load clip.</p>
      <p><a href="${escapeHtml(fallbackUrl)}" target="_blank" rel="noopener noreferrer">Open original link</a></p>
    `;
  }
}

export function showPreviousModalMedia() {
  const pin = state.modalPin;
  if (!pin) return;
  const count = getPinMediaItems(pin).length;
  if (count <= 1) return;
  state.modalMediaIndex = (state.modalMediaIndex - 1 + count) % count;
  updateModalMediaNav(pin);
  getModalPlayer().innerHTML = '<p class="preview-loading">Loading clip…</p>';
  loadModalPlayer(pin, state.modalMediaIndex);
}

export function showNextModalMedia() {
  const pin = state.modalPin;
  if (!pin) return;
  const count = getPinMediaItems(pin).length;
  if (count <= 1) return;
  state.modalMediaIndex = (state.modalMediaIndex + 1) % count;
  updateModalMediaNav(pin);
  getModalPlayer().innerHTML = '<p class="preview-loading">Loading clip…</p>';
  loadModalPlayer(pin, state.modalMediaIndex);
}

export function initModalMediaNav() {
  const modal = getModal();
  modal?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeModal();
  });

  modal?.addEventListener("beforetoggle", (event) => {
    if (event.newState !== "closed") return;
    if (isModalDismissGuarded() && state.modalPin) {
      event.preventDefault();
    }
  });

  modal?.addEventListener("click", (event) => {
    if (event.target !== modal || event.button !== 0) return;
    if (isModalDismissGuarded()) return;
    closeModal();
  });

  getModalMediaPrev()?.addEventListener("click", showPreviousModalMedia);
  getModalMediaNext()?.addEventListener("click", showNextModalMedia);
  getModalMediaFullscreen()?.addEventListener("click", () => {
    void toggleModalMediaFullscreen();
  });

  document.addEventListener("fullscreenchange", syncModalMediaFullscreenButton);

  document.addEventListener("keydown", (event) => {
    if (!getModal()?.open || !state.modalPin) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPreviousModalMedia();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showNextModalMedia();
    }
  });
}

const MODAL_DISMISS_GUARD_MS = 300;
let modalDismissGuardUntil = 0;

export function armModalDismissGuard() {
  modalDismissGuardUntil = Date.now() + MODAL_DISMISS_GUARD_MS;
}

function isModalDismissGuarded() {
  return Date.now() < modalDismissGuardUntil;
}

function clearModalDismissGuard() {
  modalDismissGuardUntil = 0;
}

const MODAL_CLOSE_MS = 320;

let pendingCloseTimer = null;
let pendingCloseAnimationHandler = null;
let pendingCloseId = 0;

function cancelPendingModalClose() {
  pendingCloseId += 1;
  if (pendingCloseTimer != null) {
    clearTimeout(pendingCloseTimer);
    pendingCloseTimer = null;
  }
  if (pendingCloseAnimationHandler) {
    getModal()?.removeEventListener("animationend", pendingCloseAnimationHandler);
    pendingCloseAnimationHandler = null;
  }
}

function finishModalClose(closeId) {
  if (closeId !== pendingCloseId) return;
  pendingCloseTimer = null;
  pendingCloseAnimationHandler = null;

  const modal = getModal();
  modal.classList.remove("is-closing");
  modal.close();
  if (document.activeElement?.classList?.contains("map-mg-spot")) {
    document.activeElement.blur();
  }
}

export function closeModal() {
  const modal = getModal();
  if (!modal?.open || modal.classList.contains("is-closing")) return;

  clearModalDismissGuard();
  cancelPendingModalClose();
  const closeId = pendingCloseId;

  modal.classList.add("is-closing");
  pendingCloseTimer = setTimeout(() => finishModalClose(closeId), MODAL_CLOSE_MS);
  pendingCloseAnimationHandler = (event) => {
    if (event.target !== modal) return;
    if (pendingCloseTimer != null) {
      clearTimeout(pendingCloseTimer);
      pendingCloseTimer = null;
    }
    finishModalClose(closeId);
  };
  modal.addEventListener("animationend", pendingCloseAnimationHandler, { once: true });
}

export function handleModalCloseEvent() {
  const modal = getModal();
  if (isModalDismissGuarded() && state.modalPin) {
    modal.classList.add("is-instant");
    if (!modal.open) {
      modal.showModal();
    }
    requestAnimationFrame(() => {
      modal.classList.remove("is-instant");
    });
    return;
  }
  clearModalPlayer();
}

export function clearModalPlayer() {
  void exitModalMediaFullscreen();
  getModalPlayer().innerHTML = "";
  setModalMediaFullscreenVisible(false);
  state.modalPin = null;
  state.modalMediaIndex = 0;
}
