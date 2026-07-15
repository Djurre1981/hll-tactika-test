import { state } from "../state.js";
import { getMapPins } from "./filter-bar.js";
import { isGuideInteractionAllowed, isStratsAppMode } from "../helpers/app-mode.js";
import { getPinTag } from "../pin-tags.js";
import { hasPinDirection, renderMgSpotGroup } from "./mg-spot-arrows.js";
import { positionPins, highlightPin } from "../helpers/proximity.js";
import { isPhoneLayout } from "../helpers/layout.js";
import { updatePinCount } from "./sidebar.js";
import {
  showPreview,
  showPreviewAtPin,
  movePreview,
  scheduleHidePreview,
} from "./pin-preview.js";
import { openModal, armModalDismissGuard } from "./pin-modal.js";
import { showPinContextMenu, hidePinContextMenu } from "./pin-context-menu.js";
import { attachClimbPinDrag, attachMgSpotDrag } from "../editor/pin-drag.js";
import { pinHasMedia } from "../helpers/pin-media.js";

export function getPinStylingClasses(pin) {
  const classes = [];
  if (!pinHasMedia(pin)) {
    classes.push("pin--no-media");
  }
  return classes;
}

export function renderPins() {
  const pinsLayer = document.getElementById("map-pins");
  if (isStratsAppMode()) {
    pinsLayer.innerHTML = "";
    updatePinCount();
    return;
  }
  pinsLayer.innerHTML = "";

  const mgPins = [];
  for (const pin of getMapPins()) {
    if (pin.tag === "mg-spot" && hasPinDirection(pin)) {
      mgPins.push(pin);
      continue;
    }

    const tag = getPinTag(pin.tag);
    const extraClasses = getPinStylingClasses(pin);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `map-pin ${tag?.className || ""} ${extraClasses.join(" ")}`;
    button.dataset.id = pin.id;
    button.setAttribute("aria-label", pin.title);

    const icon = document.createElement("i");
    icon.className = "fa-solid map-pin__icon";
    if (pin.tag === "mg-spot") {
      icon.classList.add("fa-play");
    } else {
      icon.classList.add("fa-map-pin");
    }
    button.appendChild(icon);

    attachPinInteractions(icon, pin);
    attachClimbPinDrag(button, pin);
    pinsLayer.appendChild(button);

    const label = document.createElement("span");
    label.className = "map-pin__label";
    label.dataset.id = pin.id;
    const shortTitle = pin.title.length > 14 ? pin.title.substring(0, 14) + "\u2026" : pin.title;
    label.textContent = shortTitle;
    pinsLayer.appendChild(label);
  }

  if (mgPins.length > 0) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "map-mg-spots-layer");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");

    for (const pin of mgPins) {
      const group = renderMgSpotGroup(pin, {
        highlighted: pin.id === state.highlightedPinId,
      });
      const pf = pin.faction || "neutral";
      group.classList.add(`mg-spot--${pf}`);
      if (!pinHasMedia(pin)) {
        group.classList.add("mg-spot--no-media");
      }
      group.setAttribute("role", "button");
      group.setAttribute("tabindex", "0");
      group.setAttribute("aria-label", pin.title);
      attachPinInteractions(group, pin);
      attachMgSpotDrag(group, pin);
      svg.appendChild(group);
    }

    pinsLayer.appendChild(svg);

    for (const pin of mgPins) {
      const label = document.createElement("span");
      label.className = "map-pin__label";
      label.dataset.id = pin.id;
      const shortTitle = pin.title.length > 14 ? pin.title.substring(0, 14) + "\u2026" : pin.title;
      label.textContent = shortTitle;
      pinsLayer.appendChild(label);
    }
  }

  updatePinCount();
  positionPins();
}

export function attachPinInteractions(element, pin) {
  element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !isGuideInteractionAllowed() || state.panelMode !== null) return;
    armModalDismissGuard();
  });
  element.addEventListener("mouseenter", (event) => {
    if (!isGuideInteractionAllowed() || isPhoneLayout() || state.panelMode !== null) return;
    highlightPin(pin.id);
    showPreview(pin, event);
  });
  element.addEventListener("mousemove", (event) => {
    if (!isGuideInteractionAllowed() || isPhoneLayout() || state.panelMode !== null) return;
    movePreview(event);
  });
  element.addEventListener("mouseleave", () => {
    if (!isGuideInteractionAllowed() || isPhoneLayout() || state.panelMode !== null) return;
    if (state.modalPin?.id === pin.id && document.getElementById("video-modal")?.open) return;
    scheduleHidePreview();
    highlightPin(null);
  });
  element.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!isGuideInteractionAllowed() || state.panelMode !== null) return;

    if (isPhoneLayout()) {
      if (state.phonePreviewPinId === pin.id) {
        state.phonePreviewPinId = null;
        openModal(pin);
        return;
      }
      state.phonePreviewPinId = pin.id;
      highlightPin(pin.id);
      showPreviewAtPin(pin);
      return;
    }

    openModal(pin);
  });
  element.addEventListener("contextmenu", (event) => {
    if (!isGuideInteractionAllowed() || state.panelMode === null) return;
    event.preventDefault();
    event.stopPropagation();
    hidePinContextMenu();
    state.contextMenuPin = pin;
    showPinContextMenu(event.clientX, event.clientY);
  });
}
