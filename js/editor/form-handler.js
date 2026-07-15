import { state } from "../state.js";
import { createPin, deletePin, updatePin } from "../api/pins.js";
import { cachePinDetail } from "../helpers/pin-detail-cache.js";
import { pushPinCreateSnapshot, pushPinDeleteSnapshot, pushPinUpdateSnapshot } from "./undo-redo.js";
import { deriveLegacyMediaFields, normalizeMediaItem } from "../helpers/pin-media.js";
import { isDirectionalPinTag } from "../pin-tags.js";
import { isDiscordMediaUrl } from "../utils/video.js";
import { showEditorToast } from "../ui/editor-toast.js";
import { isPlacementComplete, canSavePlacement, getPinFormTag, syncViewportFormClasses, clearDraftPlacement, isMgSpotPlacement } from "./placement-mode.js";
import { validatePinMediaForm, ensureCapturedThumbnailForSave } from "./media-form.js";
import { pinHasCompactSilentThumbnail } from "../helpers/pin-media.js";
import { renderPins } from "../ui/pin-marker.js";
import { renderPinList } from "../ui/sidebar.js";
import { highlightPin } from "../helpers/proximity.js";
import { normalizePinTitle } from "../helpers/pin-title.js";
import { ingestDiscordPinMedia } from "../helpers/discord-ingest-client.js";
import { clearPinDirty } from "../helpers/pin-persist.js";
import { roundCoord } from "../helpers/position-code.js";

const REQUIRES_FACTION_CONFIG = {
  axis: { label: "Gate", icon: "fa-archway" },
  allies: { label: "Hedgehog", icon: "fa-maximize" },
};

const AUTO_SAVE_DELAY_MS = 450;
let autoSaveTimer = null;
let autoSaveDeps = null;
let editUndoSnapshotPushed = false;
let rerunSaveAfterCurrent = false;
let lastNotifiedError = "";
let lastNotifiedAt = 0;
/** Normalized snapshot of the pin when the edit form finished loading (null = not ready). */
let editFormBaseline = null;

function normalizeRequiresForCompare(requires) {
  const source = requires && typeof requires === "object" ? requires : {};
  const keys = Object.keys(source).sort();
  const normalized = {};
  for (const key of keys) {
    const value = source[key];
    if (value === undefined || value === false || value === null) continue;
    normalized[key] = value === true ? true : value;
  }
  return normalized;
}

function normalizeMediaItemsForCompare(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => normalizeMediaItem(item))
    .filter(Boolean)
    .map((item) => {
      const next = { kind: item.kind, url: item.url };
      if (item.isThumbnail) next.isThumbnail = true;
      return next;
    });
}

function normalizePinPayloadForCompare(payload) {
  const requires = normalizeRequiresForCompare(payload?.requires);
  const mediaItems = normalizeMediaItemsForCompare(payload?.mediaItems);
  const normalized = {
    title: normalizePinTitle(payload?.title || ""),
    description: String(payload?.description || "").trim(),
    tag: payload?.tag || "",
    x: roundCoord(Number(payload?.x)),
    y: roundCoord(Number(payload?.y)),
    videoUrl: String(payload?.videoUrl || "").trim(),
    thumbnail: String(payload?.thumbnail || "").trim(),
    mediaItems,
    faction: payload?.faction || "neutral",
    requires,
  };
  if (payload?.dirX != null && payload?.dirY != null) {
    normalized.dirX = roundCoord(Number(payload.dirX));
    normalized.dirY = roundCoord(Number(payload.dirY));
  }
  return normalized;
}

function pinPayloadEquals(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function clearEditFormBaseline() {
  editFormBaseline = null;
}

export function isEditFormBaselineReady() {
  return editFormBaseline != null;
}

function buildPinDataFromForm(mediaItems, thumbnail) {
  const title = normalizePinTitle(getPinTitle()?.value);
  const tag = getPinFormTag();
  if (!title || !tag || !state.pendingCoords) return null;

  const mediaFields = deriveLegacyMediaFields(mediaItems, thumbnail);
  const pinData = {
    title,
    description: getPinDescription()?.value.trim() || "",
    videoUrl: mediaFields.videoUrl,
    thumbnail: mediaFields.thumbnail || "",
    mediaItems: mediaFields.mediaItems,
    tag,
    x: state.pendingCoords.x,
    y: state.pendingCoords.y,
    faction: state.pendingFaction,
  };

  if (isDirectionalPinTag(tag)) {
    if (!state.pendingDirection) return null;
    pinData.dirX = state.pendingDirection.x;
    pinData.dirY = state.pendingDirection.y;
  }

  const requires = getRequiresData();
  pinData.requires = Object.keys(requires).length > 0 ? requires : {};
  return pinData;
}

/** Snapshot the loaded edit form so unchanged backs/switches skip KV writes. */
export function captureEditFormBaselineFromForm() {
  const mediaValidation = validatePinMediaForm({ showErrors: false });
  if (!mediaValidation.valid) {
    editFormBaseline = null;
    return;
  }
  const pinData = buildPinDataFromForm(
    mediaValidation.items,
    mediaValidation.thumbnail || ""
  );
  editFormBaseline = pinData ? normalizePinPayloadForCompare(pinData) : null;
}

function isUnchangedEditPayload(pinData) {
  if (!editFormBaseline || state.panelMode !== "edit" || !state.editingPinId) {
    return false;
  }
  return pinPayloadEquals(normalizePinPayloadForCompare(pinData), editFormBaseline);
}

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
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
}

export async function waitForPinSaveComplete() {
  while (state.pinSaveInFlight) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export async function flushAndSavePin(deps = autoSaveDeps) {
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

function getRequiresOptions() {
  return document.getElementById("pin-requires-options");
}

function getPinTitle() {
  return document.getElementById("pin-title");
}

function getPinDescription() {
  return document.getElementById("pin-description");
}

function getBtnDeletePin() {
  return document.getElementById("btn-delete-pin");
}

export function initRequiresCheckboxes() {
  const requiresOptions = getRequiresOptions();
  if (!requiresOptions) return;
  requiresOptions.querySelectorAll(".requires-checkbox").forEach((label) => {
    const checkbox = label.querySelector('input[type="checkbox"]');
    if (!checkbox) return;
    checkbox.addEventListener("change", () => {
      label.classList.toggle("is-checked", checkbox.checked);
      scheduleAutoSave();
    });
    label.addEventListener("click", (event) => {
      event.preventDefault();
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change"));
    });
  });
}

export function scheduleAutoSave() {
  // Intentionally no-op: pin edits flush once on back arrow (KV free-tier).
}

export function initAutoSave(deps) {
  autoSaveDeps = deps;
}

export function updateFactionRequires(faction) {
  const requiresFactionCheckbox = document.querySelector(".requires-checkbox--faction");
  if (!requiresFactionCheckbox) return;
  if (faction === "neutral") {
    requiresFactionCheckbox.classList.add("hidden");
    return;
  }
  const config = REQUIRES_FACTION_CONFIG[faction];
  if (config) {
    const label = document.getElementById("requires-faction-label");
    const icon = document.getElementById("requires-faction-icon");
    if (label) label.textContent = config.label;
    if (icon) icon.className = `fa-solid ${config.icon}`;
    requiresFactionCheckbox.classList.remove("hidden");
  } else {
    requiresFactionCheckbox.classList.add("hidden");
  }
}

export function getRequiresData() {
  const requires = {};
  const requiresOptions = getRequiresOptions();
  if (!requiresOptions) return {};
  requiresOptions.querySelectorAll(".requires-checkbox").forEach((label) => {
    const checkbox = label.querySelector('input[type="checkbox"]');
    const requiresKey = label.dataset.requires;
    if (checkbox && checkbox.checked) {
      if (requiresKey === "faction-specific") {
        requires["faction-specific"] = state.pendingFaction;
      } else {
        requires[requiresKey] = true;
      }
    }
  });
  return requires;
}

export function setRequiresData(requires) {
  const requiresOptions = getRequiresOptions();
  if (!requiresOptions) return;
  requiresOptions.querySelectorAll(".requires-checkbox").forEach((label) => {
    const checkbox = label.querySelector('input[type="checkbox"]');
    const requiresKey = label.dataset.requires;
    if (!checkbox) return;
    let isChecked = false;
    if (requiresKey === "faction-specific") {
      isChecked = Boolean(requires && requires["faction-specific"]);
    } else {
      isChecked = Boolean(requires && requires[requiresKey]);
    }
    checkbox.checked = isChecked;
    label.classList.toggle("is-checked", isChecked);
  });
}

export function resetRequires() {
  const requiresOptions = getRequiresOptions();
  if (!requiresOptions) return;
  requiresOptions.querySelectorAll(".requires-checkbox").forEach((label) => {
    const checkbox = label.querySelector('input[type="checkbox"]');
    if (!checkbox) return;
    checkbox.checked = false;
    label.classList.remove("is-checked");
  });
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
    reloadPinsForMap,
    backToEditorBrowse: backToEditorBrowseFn,
    canModifyFn,
    autoSave,
    navigateOnSuccess,
    notifyUser,
  });
}

export async function savePin(
  pinData,
  {
    reloadPinsForMap,
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
      await reloadPinsForMap(state.currentMapId);

      if (autoSave) {
        renderPins();
        renderPinList();
        highlightPin(state.editingPinId);
      } else if (navigateOnSuccess) {
        backToEditorBrowseFn({ preserveHistory: true });
      }
      return { ok: true };
    }

    if (state.panelMode === "add") {
      const created = await createPin(state.currentMapId, payload);
      cachePinDetail(state.currentMapId, created.id, created);
      clearPinDirty(created.id);
      await reloadPinsForMap(state.currentMapId);
      pushPinCreateSnapshot(created.id);
      editUndoSnapshotPushed = true;
      state.editingPinId = created.id;
      state.panelMode = "edit";
      captureEditFormBaselineFromForm();
      syncViewportFormClasses();

      if (autoSave) {
        renderPins();
        renderPinList();
        highlightPin(created.id);
      } else if (navigateOnSuccess) {
        backToEditorBrowseFn({ preserveHistory: true });
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
