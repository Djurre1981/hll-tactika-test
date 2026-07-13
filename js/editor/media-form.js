import { uploadPreviewImage, uploadVideo } from "../api/media.js";
import { normalizeVideoUrl } from "../utils/video.js";
import { fileFromVideoFrame } from "../utils/video-frame.js";
import {
  detectMediaKind,
  getUnsupportedMediaUrlMessage,
  isDirectImageUrl,
} from "../helpers/pin-media.js";
import { escapeHtml } from "../helpers/sanitizer.js";

const UPLOAD_BUTTON_HTML =
  '<i class="fa-solid fa-image" aria-hidden="true"></i>';

const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const UPLOAD_SIZE_ERROR_MS = 2200;

let uploadSizeErrorTimer = null;
let activeUploadRow = null;
let selectedThumbnailUrl = null;

function getMediaList() {
  return document.getElementById("pin-media-list");
}

function getMediaFileInput() {
  return document.getElementById("pin-media-file");
}

function getMediaFieldset() {
  return document.querySelector(".pin-form__media");
}

function isPinFormOpen() {
  const panel = document.getElementById("edit-panel");
  return Boolean(panel && !panel.classList.contains("hidden"));
}

function resolveUploadTargetRow(preferredRow = null) {
  if (preferredRow) return preferredRow;
  const rows = [...getMediaList()?.querySelectorAll(".pin-media-row") || []];
  const empty = rows.find((row) => !row.querySelector(".pin-media-row__url")?.value.trim());
  return empty || rows[0] || null;
}

function getDropFile(dataTransfer) {
  const files = dataTransfer?.files;
  if (!files?.length) return null;
  for (const file of files) {
    if (isVideoFile(file) || isImageFile(file)) return file;
  }
  return files[0];
}

function clearDragoverState(fieldset) {
  fieldset?.classList.remove("is-dragover");
  fieldset?.querySelectorAll(".pin-media-row__url-wrap.is-dragover").forEach((el) => {
    el.classList.remove("is-dragover");
  });
}

function setDragoverTarget(fieldset, wrap) {
  clearDragoverState(fieldset);
  if (wrap) {
    wrap.classList.add("is-dragover");
  } else {
    fieldset?.classList.add("is-dragover");
  }
}

async function startMediaUpload(file, preferredRow = null) {
  if (isMediaUploadInProgress()) return;
  const row = resolveUploadTargetRow(preferredRow);
  if (!row) return;
  activeUploadRow = row;
  await handleMediaFileUpload(file);
}

function getRowUploadButton(row) {
  return row?.querySelector(".pin-media-row__upload") || null;
}

function notifyFormChanged() {
  document.dispatchEvent(new CustomEvent("pin-form-changed"));
}

function createMediaRow({ url = "", isFirst = false, isThumbnail = false } = {}) {
  const row = document.createElement("div");
  row.className = "pin-media-row";
  const actionClass = isFirst ? "pin-media-row__add" : "pin-media-row__remove";
  const actionLabel = isFirst ? "Add link" : "Remove media";
  const actionContent = isFirst ? "+" : "&times;";
  const thumbnailActiveClass = isThumbnail ? " is-active" : "";
  row.innerHTML = `
    <div class="pin-media-row__url-wrap">
      <input
        type="text"
        class="pin-media-row__url glass-input"
        placeholder="https://..."
        value="${escapeHtml(url)}"
      />
      <button
        type="button"
        class="pin-media-row__thumbnail${thumbnailActiveClass}"
        title="Use as pin preview"
        aria-label="Use as pin preview"
        aria-pressed="${isThumbnail ? "true" : "false"}"
      ><i class="fa-solid fa-star" aria-hidden="true"></i></button>
      <button
        type="button"
        class="pin-media-row__upload"
        title="Upload file"
        aria-label="Upload file"
      >${UPLOAD_BUTTON_HTML}</button>
      <span class="pin-media-row__error" hidden></span>
    </div>
    <button type="button" class="pin-media-row__action ${actionClass}" aria-label="${actionLabel}">${actionContent}</button>
  `;

  const uploadBtn = row.querySelector(".pin-media-row__upload");
  uploadBtn?.addEventListener("click", () => {
    if (uploadBtn.disabled) return;
    activeUploadRow = resolveUploadTargetRow(row);
    getMediaFileInput()?.click();
  });

  const thumbnailBtn = row.querySelector(".pin-media-row__thumbnail");
  thumbnailBtn?.addEventListener("click", () => {
    const parsed = parseMediaRow(row);
    if (!parsed || parsed.invalidInput) {
      parsed?.invalidInput?.reportValidity();
      return;
    }
    selectedThumbnailUrl = parsed.url;
    syncThumbnailUi();
    notifyFormChanged();
  });

  const actionBtn = row.querySelector(".pin-media-row__action");
  if (isFirst) {
    actionBtn.addEventListener("click", () => {
      getMediaList()?.appendChild(createMediaRow());
      notifyFormChanged();
    });
  } else {
    actionBtn.addEventListener("click", () => {
      if (isRowThumbnail(row)) {
        selectedThumbnailUrl = null;
      }
      row.remove();
      syncFirstRowAction();
      syncThumbnailUi();
      notifyFormChanged();
    });
  }

  return row;
}

function isRowThumbnail(row) {
  const parsed = parseMediaRow(row);
  if (!parsed || parsed.invalidInput || !selectedThumbnailUrl) return false;
  return normalizeVideoUrl(parsed.url) === normalizeVideoUrl(selectedThumbnailUrl);
}

function syncThumbnailUi() {
  getMediaList()?.querySelectorAll(".pin-media-row").forEach((row) => {
    const btn = row.querySelector(".pin-media-row__thumbnail");
    const active = isRowThumbnail(row);
    btn?.classList.toggle("is-active", active);
    btn?.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function resolveFormThumbnail(items) {
  if (items.length === 0) return "";
  if (selectedThumbnailUrl) {
    const match = items.find(
      (item) => normalizeVideoUrl(item.url) === normalizeVideoUrl(selectedThumbnailUrl)
    );
    if (match) return match.url;
    // Auto-captured stills are stored as /api/images/… without a media row.
    if (isDirectImageUrl(selectedThumbnailUrl)) {
      return selectedThumbnailUrl;
    }
  }
  const firstImage = items.find((item) => item.kind === "image");
  return firstImage?.url || items[0].url;
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
    const replacement = createMediaRow({
      url,
      isFirst: shouldBeFirst,
      isThumbnail: isRowThumbnail(row),
    });
    row.replaceWith(replacement);
  });
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

function setUploadBusy(row, label) {
  const btn = getRowUploadButton(row);
  if (!btn) return;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>`;
  if (label) btn.title = label;
}

function resetUploadButton(row) {
  const btn = getRowUploadButton(row);
  if (!btn) return;
  btn.disabled = false;
  btn.innerHTML = UPLOAD_BUTTON_HTML;
  btn.title = "Upload file";
}

function clearUploadSizeError() {
  if (uploadSizeErrorTimer) {
    clearTimeout(uploadSizeErrorTimer);
    uploadSizeErrorTimer = null;
  }

  getMediaList()?.querySelectorAll(".pin-media-row").forEach((row) => {
    const wrap = row.querySelector(".pin-media-row__url-wrap");
    const input = row.querySelector(".pin-media-row__url");
    if (input) {
      input.classList.remove("is-error");
      if (input.dataset.mediaPlaceholder) {
        input.placeholder = input.dataset.mediaPlaceholder;
        delete input.dataset.mediaPlaceholder;
      }
    }
    wrap?.classList.remove("is-showing-error");
    const error = row.querySelector(".pin-media-row__error");
    if (error) {
      error.hidden = true;
    }
  });
}

export function isMediaUploadInProgress() {
  if (!activeUploadRow) return false;
  const btn = getRowUploadButton(activeUploadRow);
  return Boolean(btn?.disabled);
}

export function showMediaRowValidationError(row, message, { autoClearMs = null } = {}) {
  if (!row) return;

  const wrap = row.querySelector(".pin-media-row__url-wrap");
  const input = row.querySelector(".pin-media-row__url");
  const error = row.querySelector(".pin-media-row__error");
  if (input) {
    if (!input.dataset.mediaPlaceholder) {
      input.dataset.mediaPlaceholder = input.placeholder || "https://...";
    }
    input.placeholder = "";
    input.classList.add("is-error");
    input.focus();
  }
  wrap?.classList.add("is-showing-error");
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }

  if (autoClearMs != null) {
    if (uploadSizeErrorTimer) clearTimeout(uploadSizeErrorTimer);
    uploadSizeErrorTimer = setTimeout(() => {
      clearUploadSizeError();
    }, autoClearMs);
  }
}

function showUploadSizeError(message, row = activeUploadRow) {
  clearUploadSizeError();

  const btn = getRowUploadButton(row);
  if (btn) {
    btn.classList.remove("is-shake");
    void btn.offsetWidth;
    btn.classList.add("is-shake");
    btn.addEventListener(
      "animationend",
      () => btn.classList.remove("is-shake"),
      { once: true }
    );
  }

  showMediaRowValidationError(row, message, { autoClearMs: UPLOAD_SIZE_ERROR_MS });
}

async function handleMediaFileUpload(file) {
  const row = activeUploadRow;
  if (!row) return;

  if (!isVideoFile(file) && !isImageFile(file)) {
    alert("Unsupported file type. Use MP4, WebM, MOV, OGG, JPEG, PNG, WebP, or GIF.");
    return;
  }

  if (isVideoFile(file) && file.size > MAX_VIDEO_BYTES) {
    showUploadSizeError("max 80mb", row);
    return;
  }

  if (isImageFile(file) && file.size > MAX_IMAGE_BYTES) {
    showUploadSizeError("max 12mb", row);
    return;
  }

  clearUploadSizeError();

  try {
    let uploaded;
    if (isVideoFile(file)) {
      setUploadBusy(row, "Uploading…");
      uploaded = await uploadVideo(file);
      row.querySelector(".pin-media-row__url").value = uploaded.url;

      // Video URLs are not displayable as <img>; capture a still for hover previews.
      if (!selectedThumbnailUrl || !isDirectImageUrl(selectedThumbnailUrl)) {
        try {
          setUploadBusy(row, "Thumbnail…");
          const thumbFile = await fileFromVideoFrame(file, "preview.jpg");
          const thumb = await uploadPreviewImage(thumbFile);
          selectedThumbnailUrl = thumb.url;
          syncThumbnailUi();
        } catch (thumbError) {
          console.warn("Could not capture video thumbnail", thumbError);
        }
      }
    } else {
      setUploadBusy(row, "Uploading…");
      uploaded = await uploadPreviewImage(file);
      row.querySelector(".pin-media-row__url").value = uploaded.url;

      if (!selectedThumbnailUrl) {
        selectedThumbnailUrl = uploaded.url;
        syncThumbnailUi();
      }
    }

    notifyFormChanged();
  } catch (error) {
    console.error(error);
    alert(error.message || "Upload failed");
  } finally {
    resetUploadButton(row);
    activeUploadRow = null;
  }
}

function initMediaDropAndPaste() {
  const fieldset = getMediaFieldset();
  if (!fieldset) return;

  fieldset.addEventListener("dragover", (event) => {
    if (!isPinFormOpen()) return;
    if (!event.dataTransfer?.types?.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const wrap = event.target.closest(".pin-media-row__url-wrap");
    setDragoverTarget(fieldset, wrap);
  });

  fieldset.addEventListener("dragleave", (event) => {
    if (!fieldset.contains(event.relatedTarget)) {
      clearDragoverState(fieldset);
    }
  });

  fieldset.addEventListener("drop", async (event) => {
    if (!isPinFormOpen()) return;
    event.preventDefault();
    clearDragoverState(fieldset);
    const file = getDropFile(event.dataTransfer);
    if (!file) return;
    const row = event.target.closest(".pin-media-row");
    await startMediaUpload(file, row);
  });

  fieldset.addEventListener("paste", async (event) => {
    if (!isPinFormOpen()) return;
    const item = [...event.clipboardData.items].find((clipboardItem) =>
      clipboardItem.type.startsWith("image/")
    );
    if (!item) return;
    event.preventDefault();
    const file = item.getAsFile();
    if (!file) return;
    const focusedInput = document.activeElement?.closest?.(".pin-media-row__url");
    const row = focusedInput?.closest(".pin-media-row") || null;
    await startMediaUpload(file, row);
  });

  document.addEventListener("dragover", (event) => {
    if (!isPinFormOpen()) return;
    if (event.dataTransfer?.types?.includes("Files")) {
      event.preventDefault();
    }
  });

  document.addEventListener("drop", (event) => {
    if (!isPinFormOpen()) return;
    if (!event.target.closest(".pin-form__media")) {
      event.preventDefault();
    }
  });
}

export function initPinMediaForm() {
  const input = getMediaFileInput();
  if (!input) return;

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    await startMediaUpload(file, activeUploadRow);
  });

  getMediaList()?.addEventListener("input", (event) => {
    if (event.target.matches(".pin-media-row__url")) {
      clearUploadSizeError();
      const row = event.target.closest(".pin-media-row");
      if (row?.querySelector(".pin-media-row__thumbnail.is-active")) {
        const parsed = parseMediaRow(row);
        selectedThumbnailUrl = parsed && !parsed.invalidInput ? parsed.url : null;
      }
      syncThumbnailUi();
    }
  });

  initMediaDropAndPaste();
}

export function resetPinMediaForm() {
  const list = getMediaList();
  if (!list) return;
  selectedThumbnailUrl = null;
  list.innerHTML = "";
  list.appendChild(createMediaRow({ isFirst: true }));
  clearUploadSizeError();
}

export function setPinMediaFormItems(items, thumbnailUrl = null) {
  const list = getMediaList();
  if (!list) return;
  list.innerHTML = "";
  const normalized = Array.isArray(items) ? items.filter((item) => item?.url) : [];
  const thumb = String(thumbnailUrl || "").trim();
  if (normalized.length === 0) {
    selectedThumbnailUrl = null;
    list.appendChild(createMediaRow({ isFirst: true }));
    return;
  }
  if (thumb) {
    const match = normalized.find(
      (item) => normalizeVideoUrl(item.url) === normalizeVideoUrl(thumb)
    );
    selectedThumbnailUrl = match?.url || thumb;
  } else {
    selectedThumbnailUrl = normalized[0].url;
  }
  normalized.forEach((item, index) => {
    const isThumbnail =
      normalizeVideoUrl(item.url) === normalizeVideoUrl(selectedThumbnailUrl);
    list.appendChild(createMediaRow({ url: item.url, isFirst: index === 0, isThumbnail }));
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

export function validatePinMediaForm({ showErrors = false } = {}) {
  const list = getMediaList();
  if (!list) return { valid: true, items: [] };

  let firstInvalidInput = null;
  let firstInvalidRow = null;
  const items = [];

  list.querySelectorAll(".pin-media-row").forEach((row) => {
    const parsed = parseMediaRow(row);
    if (!parsed) return;
    if (parsed.invalidInput) {
      if (!firstInvalidInput) {
        firstInvalidInput = parsed.invalidInput;
        firstInvalidRow = row;
      }
      return;
    }
    items.push({ kind: parsed.kind, url: parsed.url });
  });

  if (firstInvalidInput) {
    const message = getUnsupportedMediaUrlMessage();
    if (showErrors && firstInvalidRow) {
      showMediaRowValidationError(firstInvalidRow, message);
    } else {
      firstInvalidInput.reportValidity();
    }
    return {
      valid: false,
      items: [],
      message,
      invalidRow: firstInvalidRow,
    };
  }

  return { valid: true, items, thumbnail: resolveFormThumbnail(items) };
}
