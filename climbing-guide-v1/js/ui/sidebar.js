import { state } from "../state.js";
import { getFilteredPins } from "./filter-bar.js";
import { isStratsAppMode } from "../helpers/app-mode.js";
import { getPinTag, normalizePinTag } from "../pin-tags.js";
import { getPinPositionCode } from "../helpers/position-code.js";
import { canModifyPin } from "../helpers/permissions.js";
import { highlightPin, focusPin } from "../helpers/proximity.js";
import { armModalDismissGuard } from "./modal-dismiss-guard.js";
import { openModal, getRequiresDisplayConfig } from "./pin-modal.js";

const FACTIONS = new Set(["axis", "allies", "neutral"]);

function normalizeFaction(faction) {
  return FACTIONS.has(faction) ? faction : "neutral";
}

function isEditorBrowseMode() {
  return state.appMode === "editor" && state.panelMode === "browse";
}

function buildRequiresRow(pin, faction) {
  const requiresWrap = document.createElement("span");
  requiresWrap.className = "pin-list__requires";

  if (!pin.requires) {
    return null;
  }

  for (const [key, value] of Object.entries(pin.requires)) {
    if (!value) continue;
    const config = getRequiresDisplayConfig(key, value, faction);
    if (!config) continue;

    const item = document.createElement("span");
    item.className = `pin-list__requires-item is-requires--${key}`;
    item.title = config.label;

    const icon = document.createElement("i");
    icon.className = config.icon;
    icon.setAttribute("aria-hidden", "true");
    item.appendChild(icon);
    requiresWrap.appendChild(item);
  }

  return requiresWrap.childElementCount > 0 ? requiresWrap : null;
}

function buildPinListBody(pin) {
  const body = document.createElement("button");
  body.type = "button";
  body.className = "pin-list__body";
  body.dataset.id = pin.id;

  const tag = getPinTag(pin.tag);
  const tagId = normalizePinTag(pin);
  const faction = normalizeFaction(pin.faction);
  const tagLabel = tag?.shortLabel || (tag?.label || tagId).slice(0, 2).toUpperCase();

  const tagSpan = document.createElement("span");
  tagSpan.className = `pin-list__tag pin-list__tag--${tagId}`;
  if (tagId === "mg-spot") {
    tagSpan.classList.add(`pin-list__tag--faction-${faction}`);
  }
  tagSpan.textContent = tagLabel;

  const titleSpan = document.createElement("span");
  titleSpan.className = "pin-list__title";

  const titleText = document.createElement("span");
  titleText.className = "pin-list__title-text";
  titleText.textContent = pin.title || "";
  titleSpan.appendChild(titleText);

  const metaSpan = document.createElement("span");
  metaSpan.className = "pin-list__meta";

  const posCodeSpan = document.createElement("span");
  posCodeSpan.className = "pin-list__position-code";
  posCodeSpan.textContent = getPinPositionCode(pin);
  metaSpan.appendChild(posCodeSpan);

  const requiresRow = buildRequiresRow(pin, faction);
  if (requiresRow) {
    metaSpan.appendChild(requiresRow);
  }

  body.appendChild(tagSpan);
  body.appendChild(titleSpan);
  body.appendChild(metaSpan);

  body.addEventListener("click", () => {
    focusPin(pin);
  });

  return body;
}

export function renderPinList() {
  const pinList = document.getElementById("pin-list");
  if (isStratsAppMode()) {
    pinList.innerHTML = "";
    updatePinCount();
    return;
  }
  pinList.innerHTML = "";
  for (const pin of getFilteredPins()) {
    const row = document.createElement("li");
    row.className = "pin-list__row";

    const item = document.createElement("div");
    item.className = "pin-list__item";

    const body = buildPinListBody(pin);

    row.addEventListener("mouseenter", () => {
      if (state.panelMode === "edit" && pin.id !== state.editingPinId) return;
      highlightPin(pin.id);
    });
    row.addEventListener("mouseleave", () => highlightPin(null));

    if (isEditorBrowseMode() && canModifyPin(pin)) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "pin-list__action pin-list__edit";
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
