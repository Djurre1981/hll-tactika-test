import { state } from "../state.js";
import { getFilteredPins } from "./filter-bar.js";
import { getPinTag } from "../pin-tags.js";
import { escapeHtml } from "../helpers/sanitizer.js";
import { getPinPositionCode } from "../helpers/position-code.js";
import { canModifyPin } from "../helpers/permissions.js";
import { highlightPin, focusPin } from "../helpers/proximity.js";
import { openModal, armModalDismissGuard, getRequiresDisplayConfig } from "./pin-modal.js";

function isEditorBrowseMode() {
  return state.panelMode === "browse";
}

export function renderPinList() {
  const pinList = document.getElementById("pin-list");
  pinList.innerHTML = "";
  for (const pin of getFilteredPins()) {
    const tag = getPinTag(pin.tag);
    const row = document.createElement("li");
    row.className = "pin-list__row";

    const item = document.createElement("div");
    item.className = "pin-list__item";

    const body = document.createElement("button");
    body.type = "button";
    body.className = "pin-list__body";
    body.dataset.id = pin.id;

    const faction = pin.faction || "neutral";

    const posCode = getPinPositionCode(pin);

    let requiresHtml = "";
    if (pin.requires) {
      for (const [key, value] of Object.entries(pin.requires)) {
        if (!value) continue;
        const config = getRequiresDisplayConfig(key, value, pin.faction || "neutral");
        if (!config) continue;
        requiresHtml += `<span class="pin-list__requires-item is-requires--${key}" title="${escapeHtml(config.label)}"><i class="${config.icon}" aria-hidden="true"></i></span>`;
      }
    }

    const tagLabel = tag?.shortLabel || (tag?.label || pin.tag).slice(0, 2).toUpperCase();

    body.innerHTML = `
      <span class="pin-list__tag pin-list__tag--${pin.tag}${pin.tag === "mg-spot" ? ` pin-list__tag--faction-${faction}` : ""}">${escapeHtml(tagLabel)}</span>
      <span class="pin-list__title">
        <span class="pin-list__title-text">${escapeHtml(pin.title)}</span>
      </span>
      <span class="pin-list__meta">
        <span class="pin-list__position-code">${posCode}</span>
        ${requiresHtml ? `<span class="pin-list__requires">${requiresHtml}</span>` : ""}
      </span>
    `;

    body.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      armModalDismissGuard();
    });
    body.addEventListener("click", () => {
      focusPin(pin);
      if (!isEditorBrowseMode()) {
        openModal(pin);
      }
    });

    row.addEventListener("mouseenter", () => {
      if (state.panelMode === "edit" && pin.id !== state.editingPinId) return;
      highlightPin(pin.id);
    });
    row.addEventListener("mouseleave", () => highlightPin(null));

    if (isEditorBrowseMode() && canModifyPin(pin)) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "pin-list__action pin-list__edit btn btn--ghost";
      editButton.title = "Edit trick";
      editButton.textContent = "Edit";
      editButton.dataset.pinId = pin.id;
      editButton.addEventListener("click", (event) => {
        event.stopPropagation();
        document.dispatchEvent(new CustomEvent("pin-list-edit", { detail: { pinId: pin.id } }));
      });
      item.appendChild(body);
      row.appendChild(item);
      row.appendChild(editButton);
    } else if (!isEditorBrowseMode()) {
      const viewButton = document.createElement("button");
      viewButton.type = "button";
      viewButton.className = "pin-list__view";
      viewButton.title = "View trick";
      viewButton.innerHTML = '<svg class="pin-list__view-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.25 2.25 8.75 6l-4.5 3.75" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      viewButton.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        armModalDismissGuard();
      });
      viewButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openModal(pin);
      });
      item.appendChild(body);
      item.appendChild(viewButton);
      row.appendChild(item);
    } else {
      item.appendChild(body);
      row.appendChild(item);
    }

    pinList.appendChild(row);
  }
}

export function updatePinCount() {
  const filtered = getFilteredPins();
  const mapName = state.currentMap?.name || "this map";
  const total = state.pins.length;
  let text;

  if (state.searchQuery.trim()) {
    text = filtered.length === 0
      ? `No spots match "${state.searchQuery.trim()}"`
      : `${filtered.length} spot${filtered.length === 1 ? "" : "s"} match your search`;
  } else if (total === 0) {
    text = `No tricks on ${mapName}`;
  } else if (filtered.length === 0) {
    text = `No tricks visible on ${mapName} — enable a tag`;
  } else if (filtered.length === total) {
    text = `${filtered.length} spot${filtered.length === 1 ? "" : "s"} on ${mapName}`;
  } else {
    text = `${filtered.length} of ${total} spots on ${mapName}`;
  }

  const pinCount = document.getElementById("pin-count");
  if (pinCount) pinCount.textContent = text;
}
