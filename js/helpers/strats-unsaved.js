import { state } from "../state.js";

let saveTimer = null;

export function markStratsDirty() {
  state.stratsDirty = true;
}

export function clearStratsDirty() {
  state.stratsDirty = false;
}

export function hasStratsUnsavedChanges() {
  return state.stratsDirty || Boolean(saveTimer);
}

export function confirmStratsUnsavedAction(message = "You have unsaved changes. Continue anyway?") {
  if (!hasStratsUnsavedChanges()) return true;
  return window.confirm(message);
}

export function discardStratsUnsavedChanges() {
  cancelStratsAutosave();
  clearStratsDirty();
}

export function scheduleStratsAutosave(callback, delayMs = 700) {
  markStratsDirty();
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    callback();
  }, delayMs);
}

export function cancelStratsAutosave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}
