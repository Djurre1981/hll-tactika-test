import { normalizeVideoUrl } from "../utils/video.js";
import {
  detectMediaKind,
  getUnsupportedMediaUrlMessage,
} from "../helpers/pin-media.js";
import { escapeHtml } from "../helpers/sanitizer.js";

function getMediaList() {
  return document.getElementById("pin-media-list");
}

function getAddMediaButton() {
  return document.getElementById("btn-add-media");
}

function createMediaRow({ url = "" } = {}) {
  const row = document.createElement("div");
  row.className = "pin-media-row";
  row.innerHTML = `
    <input
      type="text"
      class="pin-media-row__url"
      placeholder="https://..."
      value="${escapeHtml(url)}"
    />
    <button type="button" class="pin-media-row__remove" aria-label="Remove media">&times;</button>
  `;

  row.querySelector(".pin-media-row__remove").addEventListener("click", () => {
    row.remove();
    ensureAtLeastOneRow();
  });

  return row;
}

function ensureAtLeastOneRow() {
  const list = getMediaList();
  if (!list || list.children.length > 0) return;
  list.appendChild(createMediaRow());
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

export function initPinMediaForm() {
  getAddMediaButton()?.addEventListener("click", () => {
    getMediaList()?.appendChild(createMediaRow());
  });
}

export function resetPinMediaForm() {
  const list = getMediaList();
  if (!list) return;
  list.innerHTML = "";
  list.appendChild(createMediaRow());
}

export function setPinMediaFormItems(items) {
  const list = getMediaList();
  if (!list) return;
  list.innerHTML = "";
  const normalized = Array.isArray(items) ? items.filter((item) => item?.url) : [];
  if (normalized.length === 0) {
    list.appendChild(createMediaRow());
    return;
  }
  for (const item of normalized) {
    list.appendChild(createMediaRow({ url: item.url }));
  }
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
