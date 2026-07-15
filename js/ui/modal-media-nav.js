import { state } from "../state.js";
import { isPhoneLayout } from "../helpers/layout.js";
import { getPinMediaItems, getPinThumbnailMediaIndex } from "../helpers/pin-media.js";
import { createVideoElement, clearMediaContainer } from "../utils/video.js";
import { getPinPlayback } from "./pin-preview.js";
import {
  getModal,
  getModalPlayer,
  getModalPlayerWrap,
  loadModalPlayer,
} from "./pin-modal.js";
import {
  closeModal,
  isModalDismissGuarded,
} from "./modal-dismiss-guard.js";

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

function isPhoneImmersiveActive() {
  return getModalPlayerWrap()?.classList.contains("is-phone-immersive") ?? false;
}

function isModalStageFullscreen() {
  return document.fullscreenElement === getModalPlayerWrap() || isPhoneImmersiveActive();
}

function shouldShowModalFullscreenButton(player) {
  if (!player) return false;
  if (player instanceof HTMLVideoElement) return true;
  if (player instanceof HTMLImageElement) return true;
  if (player.tagName === "IFRAME") return !isPhoneLayout();
  return true;
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
  const wrap = getModalPlayerWrap();
  wrap?.classList.remove("is-phone-immersive");

  if (document.fullscreenElement === wrap) {
    try {
      await document.exitFullscreen();
    } catch {
    }
  }
  syncModalMediaFullscreenButton();
}

async function toggleModalMediaFullscreen() {
  const wrap = getModalPlayerWrap();
  if (!wrap || !modalStageHasMedia()) return;

  const player = getModalPlayer();
  const video = player?.querySelector("video");
  const img = player?.querySelector("img");

  try {
    if (video) {
      if (isPhoneLayout()) {
        if (typeof video.webkitEnterFullscreen === "function") {
          video.webkitEnterFullscreen();
        } else if (video.requestFullscreen) {
          await video.requestFullscreen();
        }
      } else if (isModalStageFullscreen()) {
        await document.exitFullscreen();
      } else {
        await wrap.requestFullscreen();
      }
      syncModalMediaFullscreenButton();
      return;
    }

    if (img && isPhoneLayout()) {
      wrap.classList.toggle("is-phone-immersive");
      syncModalMediaFullscreenButton();
      return;
    }

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

function showPreviousModalMedia() {
  const pin = state.modalPin;
  if (!pin) return;
  const count = getPinMediaItems(pin).length;
  if (count <= 1) return;
  state.modalMediaIndex = (state.modalMediaIndex - 1 + count) % count;
  updateModalMediaNav(pin);
  clearMediaContainer(getModalPlayer());
  getModalPlayer().innerHTML = '<p class="preview-loading">Loading clip…</p>';
  loadModalPlayer(pin, state.modalMediaIndex);
}

function showNextModalMedia() {
  const pin = state.modalPin;
  if (!pin) return;
  const count = getPinMediaItems(pin).length;
  if (count <= 1) return;
  state.modalMediaIndex = (state.modalMediaIndex + 1) % count;
  updateModalMediaNav(pin);
  clearMediaContainer(getModalPlayer());
  getModalPlayer().innerHTML = '<p class="preview-loading">Loading clip…</p>';
  loadModalPlayer(pin, state.modalMediaIndex);
}

function initModalMediaNav() {
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

export {
  getPinUploaderLabel,
  updateModalMediaNav,
  syncModalMediaFullscreenButton,
  setModalMediaFullscreenVisible,
  exitModalMediaFullscreen,
  toggleModalMediaFullscreen,
  showPreviousModalMedia,
  showNextModalMedia,
  initModalMediaNav,
};
