import { normalizeVideoUrl } from "../utils/video.js";
import {
  detectMediaKind,
  getUnsupportedMediaUrlMessage,
} from "../helpers/pin-media.js";
import { escapeHtml } from "../helpers/sanitizer.js";

function getMediaList() {
  return document.getElementById("pin-media-list");
}

function notifyFormChanged() {
  document.dispatchEvent(new CustomEvent("pin-form-changed"));
}

function createMediaRow({ url = "", isFirst = false } = {}) {
  const row = document.createElement("div");
  row.className = "pin-media-row";
  const actionClass = isFirst ? "pin-media-row__add" : "pin-media-row__remove";
  const actionLabel = isFirst ? "Add link" : "Remove media";
  const actionContent = isFirst ? "+" : "&times;";
  row.innerHTML = `
    <input
      type="text"
      class="pin-media-row__url glass-input"
      placeholder="https://..."
      value="${escapeHtml(url)}"
    />
    <button type="button" class="pin-media-row__action ${actionClass}" aria-label="${actionLabel}">${actionContent}</button>
  `;

  const actionBtn = row.querySelector(".pin-media-row__action");
  if (isFirst) {
    actionBtn.addEventListener("click", () => {
      getMediaList()?.appendChild(createMediaRow());
      notifyFormChanged();
    });
  } else {
    actionBtn.addEventListener("click", () => {
      row.remove();
      syncFirstRowAction();
      notifyFormChanged();
    });
  }

  return row;
}

function syncFirstRowAction() {
  const list = getMediaList();
  if (!list) return;
  const rows = list.querySelectorAll(".pin-media-row");
  if (rows.length === 0) {
    list.appendChild(createMediaRow({ isFirst: true }));
    return;
  }
  rows.forEach((row, index) => {
    const btn = row.querySelector(".pin-media-row__action");
    if (!btn) return;
    const shouldBeFirst = index === 0;
    const isAdd = btn.classList.contains("pin-media-row__add");
    if (shouldBeFirst === isAdd) return;

    const url = row.querySelector(".pin-media-row__url")?.value || "";
    const replacement = createMediaRow({ url, isFirst: shouldBeFirst });
    row.replaceWith(replacement);
  });
}

export function initPinMediaForm() {
  /* First row + button handles add; no separate control. */
}

export function resetPinMediaForm() {
  const list = getMediaList();
  if (!list) return;
  list.innerHTML = "";
  list.appendChild(createMediaRow({ isFirst: true }));
}

export function setPinMediaFormItems(items) {
  const list = getMediaList();
  if (!list) return;
  list.innerHTML = "";
  const normalized = Array.isArray(items) ? items.filter((item) => item?.url) : [];
  if (normalized.length === 0) {
    list.appendChild(createMediaRow({ isFirst: true }));
    return;
  }
  normalized.forEach((item, index) => {
    list.appendChild(createMediaRow({ url: item.url, isFirst: index === 0 }));
  });
}

export function getPinMediaFormItems() {
  const list = getMediaList();
  if (!list) return [];

  const items = [];
  list.querySelectorAll(".pin-media-row").forEach((row) => {
    const parsed = parseMediaRow(row);
    if (!parsed || parsed.invalidInput) return;
    items.push({ kind: parsed.kind, url: parsed.url });
  });
  return items;
}

function parseMediaRow(row) {
  const input = row.querySelector(".pin-media-row__url");
  const raw = String(input?.value || "").trim();
  if (!raw) return null;

  const url = normalizeVideoUrl(raw);
  const kind = detectMediaKind(url);
  if (!kind) {
    input.setCustomValidity(getUnsupportedMediaUrlMessage());
    return { invalidInput: input };
  }

  input.setCustomValidity("");
  return { kind, url };
}

export function validatePinMediaForm() {
  const list = getMediaList();
  if (!list) return { valid: true, items: [] };

  let firstInvalidInput = null;
  const items = [];

  list.querySelectorAll(".pin-media-row").forEach((row) => {
    const parsed = parseMediaRow(row);
    if (!parsed) return;
    if (parsed.invalidInput) {
      if (!firstInvalidInput) firstInvalidInput = parsed.invalidInput;
      return;
    }
    items.push({ kind: parsed.kind, url: parsed.url });
  });

  if (firstInvalidInput) {
    firstInvalidInput.reportValidity();
    return { valid: false, items: [] };
  }

  return { valid: true, items };
}
