import { state } from "../state.js";
import { createPin, deletePin, updatePin } from "../api/pins.js";
import { pushPinCreateSnapshot, pushPinDeleteSnapshot, pushPinUpdateSnapshot } from "./undo-redo.js";
import { deriveLegacyMediaFields } from "../helpers/pin-media.js";
import { isDirectionalPinTag } from "../pin-tags.js";
import { isPlacementComplete, canSavePlacement, getPinFormTag, syncViewportFormClasses, clearDraftPlacement } from "./placement-mode.js";
import { validatePinMediaForm } from "./media-form.js";
import { renderPins } from "../ui/pin-marker.js";
import { renderPinList } from "../ui/sidebar.js";
import { highlightPin } from "../helpers/proximity.js";

const REQUIRES_FACTION_CONFIG = {
  axis: { label: "Gate", icon: "fa-archway" },
  allies: { label: "Hedgehog", icon: "fa-maximize" },
};

const AUTO_SAVE_DELAY_MS = 450;
let autoSaveTimer = null;
let autoSaveDeps = null;
let editUndoSnapshotPushed = false;

export function resetEditUndoSnapshot() {
  editUndoSnapshotPushed = false;
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

export function initAutoSave(deps) {
  autoSaveDeps = deps;

  getPinTitle()?.addEventListener("input", scheduleAutoSave);
  getPinDescription()?.addEventListener("input", scheduleAutoSave);

  document.getElementById("pin-media-list")?.addEventListener("input", (event) => {
    if (event.target.matches(".pin-media-row__url")) {
      scheduleAutoSave();
    }
  });

  document.addEventListener("pin-form-changed", scheduleAutoSave);
}

export function scheduleAutoSave() {
  if (state.panelMode !== "add" && state.panelMode !== "edit") return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    if (!autoSaveDeps) return;
    onSavePin({ preventDefault() {} }, { ...autoSaveDeps, autoSave: true });
  }, AUTO_SAVE_DELAY_MS);
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

export function onSavePin(event, { reloadPinsForMap, backToEditorBrowse: backToEditorBrowseFn, canModifyFn, autoSave = false }) {
  event.preventDefault();
  if (!canSavePlacement()) return;

  const title = getPinTitle()?.value.trim();
  if (!title) return;

  const tag = getPinFormTag();
  if (!tag) return;

  const mediaValidation = validatePinMediaForm();
  if (!mediaValidation.valid) return;
  const mediaFields = deriveLegacyMediaFields(mediaValidation.items);

  const pinData = {
    title,
    description: getPinDescription().value.trim(),
    videoUrl: mediaFields.videoUrl,
    thumbnail: mediaFields.thumbnail || "",
    mediaItems: mediaFields.mediaItems,
    tag,
    x: state.pendingCoords.x,
    y: state.pendingCoords.y,
  };

  if (isDirectionalPinTag(tag)) {
    pinData.dirX = state.pendingDirection.x;
    pinData.dirY = state.pendingDirection.y;
  }

  pinData.faction = state.pendingFaction;

  const requires = getRequiresData();
  pinData.requires = Object.keys(requires).length > 0 ? requires : {};

  void savePin(pinData, { reloadPinsForMap, backToEditorBrowse: backToEditorBrowseFn, canModifyFn, autoSave });
}

export async function savePin(pinData, { reloadPinsForMap, backToEditorBrowse: backToEditorBrowseFn, canModifyFn, autoSave = false }) {
  if (state.pinSaveInFlight) return;

  state.pinSaveInFlight = true;

  try {
    if (state.panelMode === "edit" && state.editingPinId) {
      const existing = state.pins.find((item) => item.id === state.editingPinId);
      if (!existing || !canModifyFn(existing)) return;

      if (!editUndoSnapshotPushed) {
        pushPinUpdateSnapshot(existing);
        editUndoSnapshotPushed = true;
      }

      await updatePin(state.currentMapId, state.editingPinId, pinData);
      await reloadPinsForMap(state.currentMapId);

      if (autoSave) {
        renderPins();
        renderPinList();
        highlightPin(state.editingPinId);
      } else {
        backToEditorBrowseFn({ preserveHistory: true });
      }
      return;
    }

    if (state.panelMode === "add") {
      const created = await createPin(state.currentMapId, pinData);
      await reloadPinsForMap(state.currentMapId);
      pushPinCreateSnapshot(created.id);
      editUndoSnapshotPushed = true;
      state.editingPinId = created.id;
      state.panelMode = "edit";
      syncViewportFormClasses();

      if (autoSave) {
        renderPins();
        renderPinList();
        highlightPin(created.id);
      } else {
        backToEditorBrowseFn({ preserveHistory: true });
      }
    }
  } catch (error) {
    console.error(error);
    if (!autoSave) {
      alert(error.message || "Could not save trick");
    }
  } finally {
    state.pinSaveInFlight = false;
  }
}

export async function onDeleteAddPinPlacement({ reloadPinsForMap, canModifyFn }) {
  if (!state.addPinSession) return;

  if (state.editingPinId) {
    const existing = state.pins.find((item) => item.id === state.editingPinId);
    if (existing && canModifyFn(existing)) {
      try {
        await deletePin(state.currentMapId, state.editingPinId);
        await reloadPinsForMap(state.currentMapId);
        const last = state.positionHistory[state.positionHistory.length - 1];
        if (last?.mode === "pin-remove" && last.pinId === state.editingPinId) {
          state.positionHistory.pop();
        }
      } catch (error) {
        console.error(error);
        alert(error.message || "Could not delete trick");
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
    await reloadPinsForMap(state.currentMapId);
    backToEditorBrowseFn({ preserveHistory: true });
  } catch (error) {
    state.positionHistory.pop();
    console.error(error);
    alert(error.message || "Could not delete trick");
  } finally {
    if (btnDeletePin) {
      btnDeletePin.disabled = false;
    }
  }
}
