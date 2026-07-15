import { state } from "../state.js";
import { validatePinMediaForm } from "./media-form.js";
import { getPinFormTag } from "./placement-mode.js";
import { normalizePinTitle } from "../helpers/pin-title.js";
import { deriveLegacyMediaFields, normalizeMediaItem } from "../helpers/pin-media.js";
import { isDirectionalPinTag } from "../pin-tags.js";
import { roundCoord } from "../helpers/position-code.js";
import { getPinTitle, getPinDescription, getRequiresData } from "./form-handler-requires.js";

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

function clearEditFormBaseline() {
  state.editFormBaseline = null;
}

function isEditFormBaselineReady() {
  return state.editFormBaseline != null;
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

function captureEditFormBaselineFromForm() {
  const mediaValidation = validatePinMediaForm({ showErrors: false });
  if (!mediaValidation.valid) {
    state.editFormBaseline = null;
    return;
  }
  const pinData = buildPinDataFromForm(
    mediaValidation.items,
    mediaValidation.thumbnail || ""
  );
  state.editFormBaseline = pinData ? normalizePinPayloadForCompare(pinData) : null;
}

function isUnchangedEditPayload(pinData) {
  if (!state.editFormBaseline || state.panelMode !== "edit" || !state.editingPinId) {
    return false;
  }
  return pinPayloadEquals(normalizePinPayloadForCompare(pinData), state.editFormBaseline);
}

export {
  normalizeRequiresForCompare,
  normalizeMediaItemsForCompare,
  normalizePinPayloadForCompare,
  pinPayloadEquals,
  clearEditFormBaseline,
  isEditFormBaselineReady,
  buildPinDataFromForm,
  captureEditFormBaselineFromForm,
  isUnchangedEditPayload,
};
