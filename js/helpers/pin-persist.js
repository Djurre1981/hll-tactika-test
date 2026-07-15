import { state } from "../state.js";
import { deriveLegacyMediaFields, getPinMediaItems, pinHasMedia } from "../helpers/pin-media.js";
import { batchUpdatePins, updatePin } from "../api/pins.js";
import { roundCoord } from "./position-code.js";
import { updatePinElementPosition } from "./proximity.js";
import { renderPinList } from "../ui/sidebar.js";
import { showEditorToast } from "../ui/editor-toast.js";
import { normalizePin } from "../ui/filter-bar.js";

const dirtyPinIds = new Set();

export function buildPinPayload(pin) {
  const items = getPinMediaItems(pin);
  const mediaFields = deriveLegacyMediaFields(items);
  const payload = {
    title: pin.title,
    description: pin.description || "",
    tag: pin.tag,
    x: pin.x,
    y: pin.y,
    videoUrl: mediaFields.videoUrl,
    thumbnail: pin.thumbnail || mediaFields.thumbnail || "",
    mediaItems: mediaFields.mediaItems,
    faction: pin.faction || "neutral",
    requires: pin.requires || {},
  };
  if (pin.dirX != null && pin.dirY != null) {
    payload.dirX = pin.dirX;
    payload.dirY = pin.dirY;
  }
  return payload;
}

export function syncPinInCatalog(pin) {
  const list = state.pinCatalog[state.currentMapId];
  if (!list) return;
  const index = list.findIndex((item) => item.id === pin.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...pin };
  }
}

/** Build a map-marker shape from a saved full pin without reloading the map. */
export function toLocalPinMarker(fullPin, existingMarker = null) {
  const marker = {
    id: fullPin.id,
    title: fullPin.title,
    tag: fullPin.tag,
    x: fullPin.x,
    y: fullPin.y,
    faction: fullPin.faction,
    requires: fullPin.requires || {},
    createdBy: fullPin.createdBy ?? existingMarker?.createdBy ?? null,
    detailToken: existingMarker?.detailToken,
    hasMedia: pinHasMedia(fullPin),
  };
  const thumbnail = String(fullPin.thumbnail || "").trim();
  if (thumbnail) marker.thumbnail = thumbnail;
  if (fullPin.tag === "mg-spot" && fullPin.dirX != null && fullPin.dirY != null) {
    marker.dirX = fullPin.dirX;
    marker.dirY = fullPin.dirY;
  }
  return normalizePin(marker);
}

/** Upsert one saved pin into local list + catalog (skips full map reload). */
export function upsertLocalPinMarker(fullPin, mapId = state.currentMapId) {
  if (!fullPin?.id) return null;
  const catalog = state.pinCatalog[mapId] || (state.pinCatalog[mapId] = []);
  const existing =
    state.pins.find((item) => item.id === fullPin.id) ||
    catalog.find((item) => item.id === fullPin.id) ||
    null;
  const marker = toLocalPinMarker(fullPin, existing);

  const pinIndex = state.pins.findIndex((item) => item.id === marker.id);
  if (pinIndex >= 0) state.pins[pinIndex] = { ...state.pins[pinIndex], ...marker };
  else if (mapId === state.currentMapId) state.pins.push(marker);

  const catalogIndex = catalog.findIndex((item) => item.id === marker.id);
  if (catalogIndex >= 0) catalog[catalogIndex] = { ...catalog[catalogIndex], ...marker };
  else catalog.push(marker);

  return marker;
}

export function normalizePinCoords(pin) {
  pin.x = roundCoord(pin.x);
  pin.y = roundCoord(pin.y);
  if (pin.dirX != null && pin.dirY != null) {
    pin.dirX = roundCoord(pin.dirX);
    pin.dirY = roundCoord(pin.dirY);
  }
}

export function markPinDirty(pinId) {
  if (pinId) dirtyPinIds.add(pinId);
}

export function clearPinDirty(pinId) {
  if (pinId) dirtyPinIds.delete(pinId);
}

export function clearAllDirtyPins() {
  dirtyPinIds.clear();
}

export function hasDirtyPins() {
  return dirtyPinIds.size > 0;
}

/** Keep position changes local until flush (back / exit editor). */
export function persistPinPosition(pin) {
  if (!pin?.id) return;
  normalizePinCoords(pin);
  syncPinInCatalog(pin);
  updatePinElementPosition(pin.id);
  renderPinList();
  markPinDirty(pin.id);
}

/** One KV write for all browse/nudge dirty pins on this map. */
export async function flushDirtyPinPositions() {
  if (dirtyPinIds.size === 0) return { ok: true };

  if (state.pinSaveInFlight) {
    throw new Error("Save already in progress");
  }

  const ids = [...dirtyPinIds];
  const pins = [];
  for (const id of ids) {
    const pin = state.pins.find((item) => item.id === id)
      || state.pinCatalog[state.currentMapId]?.find((item) => item.id === id);
    if (!pin) {
      dirtyPinIds.delete(id);
      continue;
    }
    normalizePinCoords(pin);
    pins.push({ id: pin.id, ...buildPinPayload(pin) });
  }

  if (pins.length === 0) {
    dirtyPinIds.clear();
    return { ok: true };
  }

  state.pinSaveInFlight = true;
  try {
    if (pins.length === 1) {
      const updated = await updatePin(state.currentMapId, pins[0].id, pins[0]);
      const local = state.pins.find((item) => item.id === updated.id);
      if (local) Object.assign(local, updated);
      syncPinInCatalog(updated);
    } else {
      const updatedList = await batchUpdatePins(state.currentMapId, pins);
      for (const updated of updatedList) {
        const local = state.pins.find((item) => item.id === updated.id);
        if (local) Object.assign(local, updated);
        syncPinInCatalog(updated);
      }
    }
    for (const pin of pins) dirtyPinIds.delete(pin.id);
    renderPinList();
    return { ok: true };
  } catch (error) {
    console.error(error);
    showEditorToast(error.message || "Could not save pin positions");
    return { ok: false, error };
  } finally {
    state.pinSaveInFlight = false;
  }
}
