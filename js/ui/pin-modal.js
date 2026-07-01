import { state } from "../state.js";
import { getPinPlayback } from "./pin-preview.js";
import { hidePreviewImmediately } from "./pin-preview.js";
import { escapeHtml } from "../helpers/sanitizer.js";
import { generatePositionCode } from "../helpers/position-code.js";
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

function getModalFactionIcon() {
  return document.getElementById("modal-faction-icon");
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
  state.modalPin = pin;
  state.modalMediaIndex = 0;
  getModalTitle().textContent = pin.title;
  getModalDescription().textContent = pin.description || "";

  const faction = pin.faction || "neutral";
  const modalFactionIcon = getModalFactionIcon();
  if (modalFactionIcon) {
    const FACTION_CONFIG = {
      axis: { icon: "fa-solid fa-person-rifle", label: "Axis" },
      allies: { icon: "fa-solid fa-person-rifle", label: "Allies" },
      neutral: { icon: "fa-solid fa-skull-crossbones", label: "Neutral" },
    };
    const config = FACTION_CONFIG[faction] || FACTION_CONFIG.neutral;
    modalFactionIcon.className = `video-modal__faction-icon faction--${faction} ${config.icon}`;
    const textEl = document.getElementById("modal-faction-text");
    const sepEl = document.getElementById("modal-faction-sep");
    if (textEl) textEl.textContent = config.label;
    if (sepEl) sepEl.textContent = " - ";
    modalFactionIcon.classList.remove("hidden");
  }

  const tagEl = document.getElementById("modal-tag");
  const titleSepEl = document.getElementById("modal-title-sep");
  const tagLabel = pin.tag === "mg-spot" ? "MG SPOT" : "CLIMB";
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
  getModal().showModal();
  loadModalPlayer(pin, state.modalMediaIndex);
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

export function closeModal() {
  getModal().close();
  if (document.activeElement?.classList?.contains("map-mg-spot")) {
    document.activeElement.blur();
  }
}

export function clearModalPlayer() {
  void exitModalMediaFullscreen();
  getModalPlayer().innerHTML = "";
  setModalMediaFullscreenVisible(false);
  state.modalPin = null;
  state.modalMediaIndex = 0;
}
