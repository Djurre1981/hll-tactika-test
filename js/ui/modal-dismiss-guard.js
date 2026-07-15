import { state } from "../state.js";
import { getModal, clearModalPlayer } from "./pin-modal.js";

const MODAL_DISMISS_GUARD_MS = 300;
let modalDismissGuardUntil = 0;

const MODAL_CLOSE_MS = 320;
let pendingCloseTimer = null;
let pendingCloseAnimationHandler = null;
let pendingCloseId = 0;

function armModalDismissGuard() {
  modalDismissGuardUntil = Date.now() + MODAL_DISMISS_GUARD_MS;
}

function isModalDismissGuarded() {
  return Date.now() < modalDismissGuardUntil;
}

function clearModalDismissGuard() {
  modalDismissGuardUntil = 0;
}

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

function closeModal() {
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

function handleModalCloseEvent() {
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

export {
  armModalDismissGuard,
  isModalDismissGuarded,
  clearModalDismissGuard,
  cancelPendingModalClose,
  finishModalClose,
  closeModal,
  handleModalCloseEvent,
};
