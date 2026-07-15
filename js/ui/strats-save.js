import { state } from "../state.js";
import { assetUrl } from "../helpers/asset-url.js";
import {
  getActiveSlide,
  sortSlides,
} from "../helpers/strat-defaults.js";
import {
  updateStrat as apiUpdateStrat,
} from "../api/strats.js";
import {
  clearStratsDirty,
  scheduleStratsAutosave,
} from "../helpers/strats-unsaved.js";
import { resetStratDrawingHistory } from "../strats/strat-drawing.js";
import { clearDrawLayer } from "../strats/strat-drawing.js";
import {
  getSwitchMapCallback,
} from "./strats-state.js";
import { setStratsPickerOpen, renderStratsPicker } from "./strats-picker.js";
import { renderStratsChrome, setStratsPanelView } from "./strats-chrome.js";

function resolveImageSrc(imagePath) {
  const path = assetUrl(imagePath);
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, window.location.origin).href;
}

function getSlideMapImage(mapId) {
  const map = state.mapCatalog.find((entry) => entry.id === mapId);
  return map?.image ? resolveImageSrc(map.image) : "";
}

function waitForMapImage(image) {
  if (image.complete && image.naturalWidth) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", reject, { once: true });
  });
}

async function syncStratSlideMapImage(slide, { fit = false } = {}) {
  const image = document.getElementById("map-image");
  const viewport = document.getElementById("map-viewport");
  if (!image) return;

  const isRaster = Boolean(slide?.rasterUrl);
  viewport?.classList.toggle("is-raster-slide", isRaster);

  if (isRaster) {
    const nextSrc = resolveImageSrc(slide.rasterUrl);
    if (image.src !== nextSrc) {
      image.src = slide.rasterUrl;
      await waitForMapImage(image);
    }
    image.alt = slide.name ? `${slide.name} strat slide` : "Strat slide";
  } else if (slide?.mapId) {
    const map = state.mapCatalog.find((entry) => entry.id === slide.mapId);
    if (map) {
      const nextSrc = resolveImageSrc(map.image);
      if (image.src !== nextSrc) {
        image.src = assetUrl(map.image);
        await waitForMapImage(image);
      }
      image.alt = `${map.name} tactical map`;
    }
  }

  state.mapOverlays?.syncGridSize();
  if (fit) {
    state.mapViewer?.fitToView();
  } else {
    state.mapViewer?.clampTranslation();
    state.mapViewer?.applyTransform();
  }
}

function setSaveStatus(message, { error = false } = {}) {
  const status = document.getElementById("strats-save-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", error);
}

function scheduleSave() {
  if (!state.activeStrat) return;
  setSaveStatus("Unsaved changes…");
  scheduleStratsAutosave(() => {
    saveActiveStrat().catch((error) => {
      setSaveStatus(error.message || "Save failed", { error: true });
    });
  });
}

async function saveActiveStrat() {
  if (!state.activeStrat || state.stratsSaveInFlight) {
    return;
  }

  state.stratsSaveInFlight = true;
  setSaveStatus("Saving…");

  try {
    const saved = await apiUpdateStrat(state.activeStrat.id, {
      title: state.activeStrat.title,
      tags: state.activeStrat.tags,
      notes: state.activeStrat.notes,
      match: state.activeStrat.match,
      slides: sortSlides(state.activeStrat.slides),
      locked: state.activeStrat.locked,
      lockedBy: state.activeStrat.lockedBy,
    });

    state.activeStrat = saved;
    const index = state.stratsCatalog.findIndex((strat) => strat.id === saved.id);
    if (index >= 0) {
      state.stratsCatalog[index] = saved;
    }
    setSaveStatus("Saved");
    clearStratsDirty();
    renderStratsPicker();
  } finally {
    state.stratsSaveInFlight = false;
  }
}

async function closeStratEditor() {
  state.activeStrat = null;
  state.activeSlideId = null;
  state.pendingDuplicateSlideId = null;
  setStratsPickerOpen(false);
  setStratsPanelView("slides");
  document.getElementById("btn-strats-details")?.classList.add("hidden");
  clearStratsDirty();
  resetStratDrawingHistory();
  clearDrawLayer();
  document.getElementById("map-viewport")?.classList.remove("is-raster-slide");
  if (state.currentMapId) {
    const cb = getSwitchMapCallback();
    await cb?.(state.currentMapId, { fit: false });
  }
  renderStratsChrome();
}

async function exitStratEditorSession() {
  if (!state.activeStrat) {
    document.getElementById("map-viewport")?.classList.remove("is-raster-slide");
    const map = state.mapCatalog.find((entry) => entry.id === state.currentMapId);
    const image = document.getElementById("map-image");
    if (map && image) {
      const nextSrc = resolveImageSrc(map.image);
      if (image.src !== nextSrc) {
        image.src = assetUrl(map.image);
        await waitForMapImage(image);
      }
      image.alt = `${map.name} tactical map`;
      state.mapOverlays?.syncGridSize();
      state.mapViewer?.fitToView();
    }
    return;
  }
  await closeStratEditor();
}

export {
  resolveImageSrc,
  getSlideMapImage,
  waitForMapImage,
  syncStratSlideMapImage,
  scheduleSave,
  saveActiveStrat,
  setSaveStatus,
  closeStratEditor,
  exitStratEditorSession,
};
