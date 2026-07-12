import { uploadPreviewImage, uploadVideo } from "../api/media.js";
import { normalizeVideoUrl } from "../utils/video.js";
import {
  detectMediaKind,
  getUnsupportedMediaUrlMessage,
} from "../helpers/pin-media.js";
import { canExtractVideoFrame, fileFromVideoFrame } from "../utils/video-frame.js";
import { escapeHtml } from "../helpers/sanitizer.js";

const UPLOAD_BUTTON_HTML =
  '<i class="fa-solid fa-file-arrow-up" aria-hidden="true"></i><span>Upload</span>';

function getMediaList() {
  return document.getElementById("pin-media-list");
}

function getUploadButton() {
  return document.getElementById("btn-upload-media");
}

function getMediaFileInput() {
  return document.getElementById("pin-media-file");
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

function appendMediaUrl(url) {
  const list = getMediaList();
  if (!list) return;

  const rows = [...list.querySelectorAll(".pin-media-row")];
  const emptyRow = rows.find((row) => !row.querySelector(".pin-media-row__url")?.value.trim());
  if (emptyRow) {
    emptyRow.querySelector(".pin-media-row__url").value = url;
    return;
  }

  list.appendChild(createMediaRow({ url, isFirst: false }));
  syncFirstRowAction();
}

function isVideoFile(file) {
  return (
    /^video\//.test(file.type) ||
    /\.(mp4|webm|mov|ogg)$/i.test(file.name)
  );
}

function isImageFile(file) {
  return (
    /^image\/(jpeg|png|webp|gif)$/i.test(file.type) ||
    /\.(jpe?g|png|webp|gif)$/i.test(file.name)
  );
}

function setUploadBusy(btn, label) {
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><span>${label}</span>`;
}

function resetUploadButton(btn) {
  btn.disabled = false;
  btn.innerHTML = UPLOAD_BUTTON_HTML;
}

async function handleMediaFileUpload(file) {
  const btn = getUploadButton();
  if (!btn) return;

  if (!isVideoFile(file) && !isImageFile(file)) {
    alert("Unsupported file type. Use MP4, WebM, MOV, OGG, JPEG, PNG, WebP, or GIF.");
    return;
  }

  try {
    if (isVideoFile(file)) {
      setUploadBusy(btn, "Uploading…");
      const uploaded = await uploadVideo(file);
      appendMediaUrl(uploaded.url);

      const hasImage = getPinMediaFormItems().some((item) => item.kind === "image");
      if (!hasImage && canExtractVideoFrame(uploaded.url)) {
        setUploadBusy(btn, "Preview…");
        const previewFile = await fileFromVideoFrame(uploaded.url);
        const preview = await uploadPreviewImage(previewFile);
        appendMediaUrl(preview.url);
      }
    } else {
      setUploadBusy(btn, "Uploading…");
      const uploaded = await uploadPreviewImage(file);
      appendMediaUrl(uploaded.url);
    }

    notifyFormChanged();
  } catch (error) {
    console.error(error);
    alert(error.message || "Upload failed");
  } finally {
    resetUploadButton(btn);
  }
}

export function initPinMediaForm() {
  const btn = getUploadButton();
  const input = getMediaFileInput();
  if (!btn || !input) return;

  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    input.click();
  });

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    await handleMediaFileUpload(file);
  });
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
