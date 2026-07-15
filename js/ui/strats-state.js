import { state } from "../state.js";

export const STRAT_UI_PREFS_KEY = "hll-tactika-strat-ui-prefs";

let _slideDragId = null;
let _stratsPickerOpen = false;
let _switchMapCallback = null;
let _importPreviewTimer = null;
let _stratDeleteConfirmResolver = null;

export function getSlideDragId() { return _slideDragId; }
export function setSlideDragId(v) { _slideDragId = v; }

export function getStratsPickerOpen() { return _stratsPickerOpen; }
export function setStratsPickerOpenValue(v) { _stratsPickerOpen = v; }

export function getSwitchMapCallback() { return _switchMapCallback; }
export function setSwitchMapCallback(v) { _switchMapCallback = v; }

export function getImportPreviewTimer() { return _importPreviewTimer; }
export function setImportPreviewTimer(v) { _importPreviewTimer = v; }

export function getStratDeleteConfirmResolver() { return _stratDeleteConfirmResolver; }
export function setStratDeleteConfirmResolver(v) { _stratDeleteConfirmResolver = v; }

export function getMapName(mapId) {
  return state.mapCatalog.find((map) => map.id === mapId)?.name || mapId;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
