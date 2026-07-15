import { state } from "../state.js";
import { createPin, deletePin, updatePin } from "../api/pins.js";
import { cachePinDetail } from "../helpers/pin-detail-cache.js";
import { pushPinCreateSnapshot, pushPinDeleteSnapshot, pushPinUpdateSnapshot } from "./undo-redo.js";
import { deriveLegacyMediaFields, normalizeMediaItem, pinHasCompactSilentThumbnail } from "../helpers/pin-media.js";
import { isDirectionalPinTag } from "../pin-tags.js";
import { isDiscordMediaUrl } from "../utils/video.js";
import { showEditorToast } from "../ui/editor-toast.js";
import { isPlacementComplete, canSavePlacement, getPinFormTag, syncViewportFormClasses, clearDraftPlacement, isMgSpotPlacement } from "./placement-mode.js";
import { validatePinMediaForm, ensureCapturedThumbnailForSave } from "./media-form.js";
import { renderPins } from "../ui/pin-marker.js";
import { renderPinList } from "../ui/sidebar.js";
import { highlightPin } from "../helpers/proximity.js";
import { normalizePinTitle } from "../helpers/pin-title.js";
import { ingestDiscordPinMedia } from "../helpers/discord-ingest-client.js";
import { clearPinDirty, upsertLocalPinMarker } from "../helpers/pin-persist.js";
import { roundCoord } from "../helpers/position-code.js";
import {
  buildPinDataFromForm,
  captureEditFormBaselineFromForm,
  isUnchangedEditPayload,
  clearEditFormBaseline,
  isEditFormBaselineReady,
  normalizePinPayloadForCompare,
  pinPayloadEquals,
  normalizeRequiresForCompare,
  normalizeMediaItemsForCompare,
} from "./form-handler-baseline.js";
import {
  initRequiresCheckboxes,
  scheduleAutoSave,
  initAutoSave,
  updateFactionRequires,
  getRequiresData,
  setRequiresData,
  resetRequires,
  getRequiresOptions,
  getPinTitle,
  getPinDescription,
  getBtnDeletePin,
} from "./form-handler-requires.js";

let editUndoSnapshotPushed = false;
let rerunSaveAfterCurrent = false;
let lastNotifiedError = "";
let lastNotifiedAt = 0;

function showSaveError(message, { notifyUser = false } = {}) {
  if (!notifyUser || !message) return;
  const text = message || "Could not save trick";
  const now = Date.now();
  if (text === lastNotifiedError && now - lastNotifiedAt < 3000) return;
  lastNotifiedError = text;
  lastNotifiedAt = now;
  showEditorToast(text, { durationMs: 5000 });
}

function shakePlacementField() {
  const coordsEl = document.getElementById("pin-coords");
  if (!coordsEl) return;
  coordsEl.classList.remove("is-shake");
  void coordsEl.offsetWidth;
  coordsEl.classList.add("is-shake");
  coordsEl.addEventListener(
    "animationend",
    () => coordsEl.classList.remove("is-shake"),
    { once: true }
  );
}

function getPlacementErrorMessage() {
  if (state.mgCollapseHint) {
    return "Separate the MG arrowhead and bar before saving.";
  }
  if (isMgSpotPlacement()) {
    if (!state.pendingDirection) {
      return "Click the map for the MG arrowhead, then for the bar.";
    }
    if (!state.pendingCoords) {
      return "Click the map again to place the MG bar.";
    }
  }
  return "Click the map to place the pin before saving.";
}

export function cancelPendingAutoSave() {
  clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer = null;
}

export async function waitForPinSaveComplete() {
  while (state.pinSaveInFlight) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export async function flushAndSavePin(deps = state.autoSaveDeps) {
  if (!deps) {
    return { ok: false, reason: "save", message: "Save is not configured" };
  }

  cancelPendingAutoSave();
  await waitForPinSaveComplete();
  rerunSaveAfterCurrent = false;

  const saveOptions = { ...deps, autoSave: true, navigateOnSuccess: false, notifyUser: true };
  let result = await onSavePin({ preventDefault() {} }, saveOptions);
  if (!result.ok && result.reason === "busy") {
    await waitForPinSaveComplete();
    rerunSaveAfterCurrent = false;
    result = await onSavePin({ preventDefault() {} }, saveOptions);
  }
  return result;
}

function pinDataHasDiscordMedia(pinData) {
  if (isDiscordMediaUrl(pinData.videoUrl) || isDiscordMediaUrl(pinData.thumbnail)) {
    return true;
  }
  return (pinData.mediaItems || []).some((item) => isDiscordMediaUrl(item?.url));
}

export function resetEditUndoSnapshot() {
  editUndoSnapshotPushed = false;
}

export function markEditUndoBaselinePushed() {
  editUndoSnapshotPushed = true;
}

export async function onSavePin(
  event,
  {
    reloadPinsForMap,
    backToEditorBrowse: backToEditorBrowseFn,
    canModifyFn,
    autoSave = false,
    navigateOnSuccess = !autoSave,
    notifyUser = false,
  }
) {
  event.preventDefault();

  if (!canSavePlacement()) {
    const message = getPlacementErrorMessage();
    if (notifyUser) {
      shakePlacementField();
      showSaveError(message, { notifyUser });
    }
    return { ok: false, reason: "placement", message };
  }

  const title = normalizePinTitle(getPinTitle()?.value);
  if (!title) {
    const message = "Title is required";
    if (notifyUser) {
      getPinTitle()?.focus();
      showSaveError(message, { notifyUser });
    }
    return { ok: false, reason: "title", message };
  }
  getPinTitle().value = title;

  const tag = getPinFormTag();
  if (!tag) {
    const message = "Pin type is required";
    showSaveError(message, { notifyUser });
    return { ok: false, reason: "tag", message };
  }

  const mediaValidation = validatePinMediaForm({ showErrors: notifyUser });
  if (!mediaValidation.valid) {
    const message = mediaValidation.message || "Unsupported media URL";
    showSaveError(message, { notifyUser });
    return { ok: false, reason: "media", message };
  }

  const unchangedProbe = buildPinDataFromForm(
    mediaValidation.items,
    mediaValidation.thumbnail || ""
  );
  if (unchangedProbe && isUnchangedEditPayload(unchangedProbe)) {
    clearPinDirty(state.editingPinId);
    return { ok: true, skipped: true };
  }

  let thumbnail = mediaValidation.thumbnail || "";
  if (
    !pinHasCompactSilentThumbnail({
      thumbnail,
      mediaItems: mediaValidation.items,
    })
  ) {
    try {
      thumbnail = await ensureCapturedThumbnailForSave(
        mediaValidation.items,
        thumbnail
      );
    } catch (error) {
      console.warn("Thumbnail capture skipped:", error);
    }
  }

  const pinData = buildPinDataFromForm(mediaValidation.items, thumbnail);
  if (!pinData) {
    const message = getPlacementErrorMessage();
    showSaveError(message, { notifyUser });
    return { ok: false, reason: "placement", message };
  }

  return savePin(pinData, {
    backToEditorBrowse: backToEditorBrowseFn,
    canModifyFn,
    autoSave,
    navigateOnSuccess,
    notifyUser,
  });
}

function schedulePinUiRefresh({ highlightId = null } = {}) {
  requestAnimationFrame(() => {
    renderPins();
    renderPinList();
    if (highlightId) highlightPin(highlightId);
  });
}

export async function savePin(
  pinData,
  {
    backToEditorBrowse: backToEditorBrowseFn,
    canModifyFn,
    autoSave = false,
    navigateOnSuccess = !autoSave,
    notifyUser = false,
  }
) {
  if (state.pinSaveInFlight) {
    rerunSaveAfterCurrent = true;
    return { ok: false, reason: "busy" };
  }

  state.pinSaveInFlight = true;

  try {
    let payload = pinData;
    if (notifyUser && pinDataHasDiscordMedia(pinData)) {
      showEditorToast("Importing media from Discord…", { durationMs: 8000 });
      try {
        payload = await ingestDiscordPinMedia(pinData);
      } catch (error) {
        console.warn("Client Discord ingest failed, saving direct URL:", error);
      }
    }

    if (state.panelMode === "edit" && state.editingPinId) {
      const existing = state.pins.find((item) => item.id === state.editingPinId);
      if (!existing || !canModifyFn(existing)) {
        const message = "You do not have permission to edit this pin";
        showSaveError(message, { notifyUser });
        return { ok: false, reason: "permission", message };
      }

      if (!editUndoSnapshotPushed) {
        pushPinUpdateSnapshot(existing);
        editUndoSnapshotPushed = true;
      }

      const saved = await updatePin(state.currentMapId, state.editingPinId, payload);
      cachePinDetail(state.currentMapId, state.editingPinId, saved);
      clearPinDirty(state.editingPinId);
      captureEditFormBaselineFromForm();
      upsertLocalPinMarker(saved);

      if (autoSave) {
        schedulePinUiRefresh({ highlightId: state.editingPinId });
      } else if (navigateOnSuccess) {
        backToEditorBrowseFn({ preserveHistory: true });
        schedulePinUiRefresh();
      }
      return { ok: true };
    }

    if (state.panelMode === "add") {
      const created = await createPin(state.currentMapId, payload);
      cachePinDetail(state.currentMapId, created.id, created);
      clearPinDirty(created.id);
      upsertLocalPinMarker(created);
      pushPinCreateSnapshot(created.id);
      editUndoSnapshotPushed = true;
      state.editingPinId = created.id;
      state.panelMode = "edit";
      captureEditFormBaselineFromForm();
      syncViewportFormClasses();

      if (autoSave) {
        schedulePinUiRefresh({ highlightId: created.id });
      } else if (navigateOnSuccess) {
        backToEditorBrowseFn({ preserveHistory: true });
        schedulePinUiRefresh();
      }
      return { ok: true };
    }

    return { ok: false, reason: "save", message: "Pin form is not open" };
  } catch (error) {
    console.error(error);
    const message = error.message || "Could not save trick";
    showSaveError(message, { notifyUser });
    return { ok: false, reason: "save", message };
  } finally {
    state.pinSaveInFlight = false;
    rerunSaveAfterCurrent = false;
  }
}

export async function onDeleteAddPinPlacement({ reloadPinsForMap, canModifyFn }) {
  if (!state.addPinSession) return;

  if (state.editingPinId) {
    const existing = state.pins.find((item) => item.id === state.editingPinId);
    if (existing && canModifyFn(existing)) {
      try {
        await deletePin(state.currentMapId, state.editingPinId);
        clearPinDirty(state.editingPinId);
        await reloadPinsForMap(state.currentMapId);
        const last = state.positionHistory[state.positionHistory.length - 1];
        if (last?.mode === "pin-remove" && last.pinId === state.editingPinId) {
          state.positionHistory.pop();
        }
      } catch (error) {
        console.error(error);
        showEditorToast(error.message || "Could not delete trick");
        return;
      }
    }
    state.editingPinId = null;
  }

  resetEditUndoSnapshot();
  state.panelMode = "add";
  state.editMode = true;
  clearDraftPlacement();
  syncViewportFormClasses();
  renderPins();
  renderPinList();
  highlightPin(null);
}

export async function onDeletePin({ reloadPinsForMap, backToEditorBrowse: backToEditorBrowseFn, canModifyFn }) {
  if (state.panelMode !== "edit" || !state.editingPinId) return;

  const existing = state.pins.find((item) => item.id === state.editingPinId);
  if (!existing || !canModifyFn(existing)) return;

  const btnDeletePin = getBtnDeletePin();
  btnDeletePin && (btnDeletePin.disabled = true);

  try {
    pushPinDeleteSnapshot(existing);
    await deletePin(state.currentMapId, state.editingPinId);
    clearPinDirty(state.editingPinId);
    await reloadPinsForMap(state.currentMapId);
    backToEditorBrowseFn({ preserveHistory: true });
  } catch (error) {
    state.positionHistory.pop();
    console.error(error);
    showEditorToast(error.message || "Could not delete trick");
  } finally {
    if (btnDeletePin) {
      btnDeletePin.disabled = false;
    }
  }
}
