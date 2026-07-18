import { normalizeVideoUrl, youtubeThumbnail } from "../utils/video.js";
import {
  detectMediaKind,
  applyMediaThumbnailFlag,
  findMediaItemForThumbnail,
  getUnsupportedMediaUrlMessage,
  isDirectImageUrl,
  isPlatformThumbnailUrl,
  isPreviewStillUrl,
  mediaUrlMatchesThumbnail,
} from "../helpers/pin-media.js";
import { escapeHtml } from "../helpers/sanitizer.js";
import {
  resolveUploadTargetRow,
  getDropFile,
  clearDragoverState,
  setDragoverTarget,
  startMediaUpload,
  getRowUploadButton,
  notifyFormChanged,
  clearUploadSizeError,
  showMediaRowValidationError,
  isMediaUploadInProgress,
  setActiveUploadRow,
} from "./media-form-upload.js";
import {
  captureStillFromVideo,
  captureStillFromImage,
  ensureCapturedThumbnailForSave,
  captureSetThumbnailUrl,
  captureGetThumbnailUrl,
  captureGetThumbnailOwnerUrl,
} from "./media-form-capture.js";

export const UPLOAD_BUTTON_HTML =
  '<i class="fa-solid fa-image" aria-hidden="true"></i>';

export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const UPLOAD_SIZE_ERROR_MS = 2200;

export function getMediaList() {
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
    setActiveUploadRow(resolveUploadTargetRow(row));
    getMediaFileInput()?.click();
  });

  const thumbnailBtn = row.querySelector(".pin-media-row__thumbnail");
  thumbnailBtn?.addEventListener("click", () => {
    const parsed = parseMediaRow(row);
    if (!parsed || parsed.invalidInput) {
      parsed?.invalidInput?.reportValidity();
      return;
    }
    captureSetThumbnailUrl(
      youtubeThumbnail(parsed.url) || parsed.url,
      parsed.url
    );
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
        captureSetThumbnailUrl(null, null);
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
  if (!parsed || parsed.invalidInput) return false;
  if (
    captureGetThumbnailOwnerUrl() &&
    normalizeVideoUrl(parsed.url) === normalizeVideoUrl(captureGetThumbnailOwnerUrl())
  ) {
    return true;
  }
  if (!captureGetThumbnailUrl()) return false;
  if (mediaUrlMatchesThumbnail(parsed.url, captureGetThumbnailUrl())) return true;
  const owner = findMediaItemForThumbnail(getPinMediaFormItems(), captureGetThumbnailUrl());
  return Boolean(owner && normalizeVideoUrl(owner.url) === normalizeVideoUrl(parsed.url));
}

export function syncThumbnailUi() {
  getMediaList()?.querySelectorAll(".pin-media-row").forEach((row) => {
    const btn = row.querySelector(".pin-media-row__thumbnail");
    const active = isRowThumbnail(row);
    btn?.classList.toggle("is-active", active);
    btn?.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function resolveFormThumbnail(items) {
  if (items.length === 0) return "";
  if (captureGetThumbnailUrl()) {
    if (isPreviewStillUrl(captureGetThumbnailUrl())) {
      return captureGetThumbnailUrl();
    }
    const match = items.find((item) =>
      mediaUrlMatchesThumbnail(item.url, captureGetThumbnailUrl())
    );
    if (match) {
      return youtubeThumbnail(match.url) || match.url;
    }
  }
  const firstImage = items.find((item) => item.kind === "image" && isDirectImageUrl(item.url));
  return firstImage?.url || "";
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
    const row = resolveUploadTargetRow();
    if (row) {
      setActiveUploadRow(row);
    }
    await startMediaUpload(file, row);
  });

  getMediaList()?.addEventListener("input", (event) => {
    if (event.target.matches(".pin-media-row__url")) {
      clearUploadSizeError();
      const row = event.target.closest(".pin-media-row");
      if (row?.querySelector(".pin-media-row__thumbnail.is-active")) {
        const parsed = parseMediaRow(row);
        if (parsed && !parsed.invalidInput) {
          captureSetThumbnailUrl(
            youtubeThumbnail(parsed.url) || parsed.url,
            parsed.url
          );
        } else {
          captureSetThumbnailUrl(null, null);
        }
      }
      syncThumbnailUi();
    }
  });

  initMediaDropAndPaste();
}

export function resetPinMediaForm() {
  const list = getMediaList();
  if (!list) return;
  captureSetThumbnailUrl(null, null);
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
    captureSetThumbnailUrl(null, null);
    list.appendChild(createMediaRow({ isFirst: true }));
    return;
  }
  const flaggedOwner = findMediaItemForThumbnail(normalized, thumb);
  if (thumb) {
    if (isPreviewStillUrl(thumb)) {
      captureSetThumbnailUrl(thumb, null);
    } else {
      captureSetThumbnailUrl(
        youtubeThumbnail(flaggedOwner?.url || thumb) ||
          flaggedOwner?.url ||
          thumb,
        flaggedOwner?.url || null
      );
    }
  } else if (flaggedOwner) {
    captureSetThumbnailUrl(
      youtubeThumbnail(flaggedOwner.url) || flaggedOwner.url,
      flaggedOwner.url
    );
  } else {
    const first = normalized[0];
    captureSetThumbnailUrl(youtubeThumbnail(first.url) || first.url, first.url);
  }
  const owner =
    flaggedOwner || findMediaItemForThumbnail(normalized, captureGetThumbnailUrl());
  captureSetThumbnailUrl(captureGetThumbnailUrl(), owner?.url || null);
  normalized.forEach((item, index) => {
    const isThumbnail = owner
      ? normalizeVideoUrl(owner.url) === normalizeVideoUrl(item.url)
      : mediaUrlMatchesThumbnail(item.url, captureGetThumbnailUrl());
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

  const owner =
    captureGetThumbnailOwnerUrl() ||
    findMediaItemForThumbnail(items, captureGetThumbnailUrl())?.url ||
    null;
  return {
    valid: true,
    items: applyMediaThumbnailFlag(items, owner),
    thumbnail: resolveFormThumbnail(items),
  };
}

export {
  isPinFormOpen,
  isMediaUploadInProgress,
  captureStillFromVideo,
  captureStillFromImage,
  ensureCapturedThumbnailForSave,
};
