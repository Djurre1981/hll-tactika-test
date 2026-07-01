import { state } from "../state.js";
import { canModifyPin } from "../helpers/permissions.js";
import { getFilteredPins } from "./filter-bar.js";
import { getPinTag } from "../pin-tags.js";
import { escapeHtml } from "../helpers/sanitizer.js";
import { generatePositionCode } from "../helpers/position-code.js";
import { highlightPin, focusPin } from "../helpers/proximity.js";
import { openModal, REQUIRES_ICON_CONFIG } from "./pin-modal.js";
import { startEditPin } from "./pin-editor.js";

export function renderPinList() {
  const pinList = document.getElementById("pin-list");
  pinList.innerHTML = "";
  for (const pin of getFilteredPins()) {
    const tag = getPinTag(pin.tag);
    const row = document.createElement("li");
    row.className = "pin-list__row";

    const item = document.createElement("button");
    item.type = "button";
    item.className = "pin-list__item";
    item.dataset.id = pin.id;

    const faction = pin.faction || "neutral";

    const posX = pin.tag === "mg-spot" && pin.dirX != null ? pin.dirX : pin.x;
    const posY = pin.tag === "mg-spot" && pin.dirY != null ? pin.dirY : pin.y;
    const posCode = generatePositionCode(posX, posY);

    let requiresHtml = "";
    if (pin.requires) {
      for (const [key, value] of Object.entries(pin.requires)) {
        if (!value) continue;
        const config = REQUIRES_ICON_CONFIG[key];
        if (!config) continue;
        requiresHtml += `<span class="pin-list__requires-item is-requires--${key}" title="${escapeHtml(config.label)}"><i class="${config.icon}" aria-hidden="true"></i></span>`;
      }
    }

    item.innerHTML = `
      <span class="pin-list__title-row">
        <span class="pin-list__title">
          <span class="pin-list__title-text">${escapeHtml(pin.title)}</span>
        </span>
        <span class="pin-list__tag pin-list__tag--${pin.tag}${pin.tag === "mg-spot" ? ` pin-list__tag--faction-${faction}` : ""}">${escapeHtml(tag?.label || pin.tag)}</span>
      </span>
      <span class="pin-list__sub-row">
        <span class="pin-list__position-code">${posCode}</span>
        ${requiresHtml ? `<span class="pin-list__requires">${requiresHtml}</span>` : ""}
      </span>
    `;

    item.addEventListener("click", () => {
      focusPin(pin);
      openModal(pin);
    });

    row.addEventListener("mouseenter", () => highlightPin(pin.id));
    row.addEventListener("mouseleave", () => highlightPin(null));

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "pin-list__edit btn btn--ghost";
    editButton.title = "Edit trick";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", (event) => {
      event.stopPropagation();
      startEditPin(pin);
    });

    row.appendChild(item);
    if (canModifyPin(pin)) {
      row.appendChild(editButton);
    }
    pinList.appendChild(row);
  }
}

export function updatePinCount() {
  const filtered = getFilteredPins();
  const mapName = state.currentMap?.name || "this map";
  const total = state.pins.length;
  let text;

  if (total === 0) {
    text = `No tricks on ${mapName}`;
  } else if (filtered.length === 0) {
    text = `No tricks visible on ${mapName} — enable a tag`;
  } else if (filtered.length === total) {
    text = `${filtered.length} spot${filtered.length === 1 ? "" : "s"} on ${mapName}`;
  } else {
    text = `${filtered.length} of ${total} spots on ${mapName}`;
  }

  const pinSearch = document.getElementById("pin-search");
  pinSearch.placeholder = text;
}
