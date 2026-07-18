import { uploadPreviewImage, uploadVideo } from "../api/media.js";
import { fileFromVideoFrame, fileFromImageSource } from "../utils/video-frame.js";
import { showEditorToast } from "../ui/editor-toast.js";
import {
  getMediaList,
  isPinFormOpen,
  syncThumbnailUi,
  UPLOAD_BUTTON_HTML,
  MAX_VIDEO_BYTES,
  MAX_IMAGE_BYTES,
  UPLOAD_SIZE_ERROR_MS,
} from "./media-form.js";
import { captureSetThumbnailUrl } from "./media-form-capture.js";

let uploadSizeErrorTimer = null;
let activeUploadRow = null;

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

function getRowUploadButton(row) {
  return row?.querySelector(".pin-media-row__upload") || null;
}

function notifyFormChanged() {
  document.dispatchEvent(new CustomEvent("pin-form-changed"));
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

function showMediaRowValidationError(row, message, { autoClearMs = null } = {}) {
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

function isMediaUploadInProgress() {
  if (!activeUploadRow) return false;
  const btn = getRowUploadButton(activeUploadRow);
  return Boolean(btn?.disabled);
}

async function startMediaUpload(file, preferredRow = null) {
  if (isMediaUploadInProgress()) return;
  const row = resolveUploadTargetRow(preferredRow);
  if (!row) return;
  activeUploadRow = row;
  await handleMediaFileUpload(file, row);
}

async function handleMediaFileUpload(file, row) {
  if (!row) return;

  if (!isVideoFile(file) && !isImageFile(file)) {
    showEditorToast("Unsupported file type. Use MP4, WebM, MOV, OGG, JPEG, PNG, WebP, or GIF.");
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

      try {
        setUploadBusy(row, "Thumbnail…");
        const thumbFile = await fileFromVideoFrame(file, "preview.jpg");
        const thumb = await uploadPreviewImage(thumbFile);
        captureSetThumbnailUrl(thumb.url, uploaded.url);
        syncThumbnailUi();
      } catch (thumbError) {
        console.warn("Could not capture video thumbnail", thumbError);
      }
    } else {
      setUploadBusy(row, "Uploading…");
      uploaded = await uploadPreviewImage(file);
      row.querySelector(".pin-media-row__url").value = uploaded.url;

      try {
        setUploadBusy(row, "Thumbnail…");
        const thumbFile = await fileFromImageSource(file, "preview.jpg");
        const thumb = await uploadPreviewImage(thumbFile);
        captureSetThumbnailUrl(thumb.url, uploaded.url);
        syncThumbnailUi();
      } catch (thumbError) {
        console.warn("Could not create image thumbnail", thumbError);
        captureSetThumbnailUrl(uploaded.url, uploaded.url);
        syncThumbnailUi();
      }
    }

    notifyFormChanged();
  } catch (error) {
    console.error(error);
    showEditorToast(error.message || "Upload failed");
  } finally {
    resetUploadButton(row);
    activeUploadRow = null;
  }
}

function setActiveUploadRow(row) {
  activeUploadRow = row;
}

export {
  isVideoFile,
  isImageFile,
  resolveUploadTargetRow,
  getDropFile,
  clearDragoverState,
  setDragoverTarget,
  startMediaUpload,
  getRowUploadButton,
  notifyFormChanged,
  setUploadBusy,
  resetUploadButton,
  clearUploadSizeError,
  showMediaRowValidationError,
  showUploadSizeError,
  isMediaUploadInProgress,
  handleMediaFileUpload,
  setActiveUploadRow,
};
