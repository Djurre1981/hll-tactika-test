import { state } from "../state.js";
import { assetUrl } from "../helpers/asset-url.js";
import {
  getActiveSlide,
  ensureStratMatch,
  sortSlides,
  getStratDefaultSlideMapId,
} from "../helpers/strat-defaults.js";
import {
  getMidpointsForMap,
  getStartingPointLabel,
  isValidStartingPoint,
  loadMapMidpoints,
} from "../helpers/map-midpoints.js";
import {
  deleteStrat as apiDeleteStrat,
  duplicateStrat as apiDuplicateStrat,
  fetchStratsCatalog,
  updateStrat as apiUpdateStrat,
} from "../api/strats.js";
import { getCurrentUser } from "../api/auth.js";
import { normalizeStratObjects } from "../strats/strat-object-schema.js";
import {
  clearStratsDirty,
  discardStratsUnsavedChanges,
  hasStratsUnsavedChanges,
  scheduleStratsAutosave,
} from "../helpers/strats-unsaved.js";
import { setStratsToolsEnabled, syncStratsToolsUi } from "./strats-tools.js";
import { clearDrawLayer, refreshDrawLayer, resetStratDrawingHistory } from "../strats/strat-drawing.js";
import {
  STRAT_UI_PREFS_KEY,
  getSwitchMapCallback,
  getMapName,
  escapeHtml,
  getStratDeleteConfirmResolver,
  setStratDeleteConfirmResolver,
} from "./strats-state.js";
import { setStratsPickerOpen, renderStratsPicker } from "./strats-picker.js";
import { renderSlidesList } from "./strats-slides.js";

export function setSaveStatus(message, { error = false } = {}) {
  const status = document.getElementById("strats-save-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", error);
}

function loadStratUiPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STRAT_UI_PREFS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveStratUiPrefs(stratId, { slideId } = {}) {
  if (!stratId) return;
  const prefs = loadStratUiPrefs();
  prefs[stratId] = {
    slideId: slideId ?? prefs[stratId]?.slideId ?? null,
  };
  localStorage.setItem(STRAT_UI_PREFS_KEY, JSON.stringify(prefs));
}

export function setStratsPanelView(view) {
  const nextView = view === "details" ? "details" : "slides";
  state.stratsPanelView = nextView;

  document.getElementById("strats-view-slides")?.classList.toggle("hidden", nextView !== "slides");
  document.getElementById("strats-view-details")?.classList.toggle("hidden", nextView !== "details");

  const detailsBtn = document.getElementById("btn-strats-details");
  detailsBtn?.classList.toggle("is-active", nextView === "details");
  detailsBtn?.setAttribute("aria-pressed", String(nextView === "details"));
}

function resolveImageSrc(imagePath) {
  const path = assetUrl(imagePath);
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, window.location.origin).href;
}

export function getSlideMapImage(mapId) {
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

export function scheduleSave() {
  if (!state.activeStrat) return;
  setSaveStatus("Unsaved changes…");
  scheduleStratsAutosave(() => {
    saveActiveStrat().catch((error) => {
      setSaveStatus(error.message || "Save failed", { error: true });
    });
  });
}

export async function saveActiveStrat() {
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

export async function closeStratEditor() {
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

export async function exitStratEditorSession() {
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

export async function openStrat(strat) {
  if (hasStratsUnsavedChanges()) {
    if (!window.confirm("Discard unsaved changes and open this strat?")) {
      return;
    }
      discardStratsUnsavedChanges();
  }

  const prefs = loadStratUiPrefs()[strat.id];
  const slides = sortSlides(strat.slides);
  const preferredSlide = slides.find((slide) => slide.id === prefs?.slideId);

  state.activeStrat = structuredClone(strat);
  ensureStratMatch(state.activeStrat);
  state.activeSlideId = preferredSlide?.id || slides[0]?.id || null;
  setStratsPanelView("slides");
  resetStratDrawingHistory();
  renderStratsChrome();
  refreshDrawLayer();
  await activateCurrentSlideMap();
}

export async function activateCurrentSlideMap() {
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  if (!slide) return;
  state.activeSlideId = slide.id;
  if (state.activeStrat) {
    saveStratUiPrefs(state.activeStrat.id, { slideId: slide.id });
  }
  slide.objects = normalizeStratObjects(slide.objects || []);
  if (slide.mapId && slide.mapId !== state.currentMapId) {
    const cb = getSwitchMapCallback();
    await cb?.(slide.mapId, { fit: false });
  }
  await syncStratSlideMapImage(slide, { fit: true });
  refreshDrawLayer();
  renderStratsChrome();
}

function updateTagBar(barId, value, attrName) {
  const bar = document.getElementById(barId);
  if (!bar) return;
  bar.dataset.currentValue = value;
  bar.querySelectorAll(`[data-${attrName}]`).forEach((button) => {
    const isActive = button.dataset[attrName] === value;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function truncateText(value, max = 28) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function formatMatchDateLabel(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMatchSummary(match) {
  if (!match) return "None";

  const parts = [];
  const dateLabel = formatMatchDateLabel(match.date);
  if (dateLabel) parts.push(dateLabel);
  if (match.faction) {
    parts.push(match.faction === "axis" ? "Axis" : "Allies");
  }
  if (match.mapId && match.startingPoint) {
    const pointLabel = getStartingPointLabel(match.mapId, match.startingPoint);
    if (pointLabel) parts.push(pointLabel);
  }
  if (match.opponent) {
    parts.push(`vs ${match.opponent}`);
  }
  if (match.result) {
    parts.push(match.result === "win" ? "Win" : "Loss");
  }

  return parts.length ? truncateText(parts.join(" · "), 42) : "None";
}

export function syncAccordionSummaries() {
  const strat = state.activeStrat;
  if (!strat) return;

  document.getElementById("strats-acc-title-value")?.replaceChildren(
    document.createTextNode(truncateText(strat.title || "Untitled Strat"))
  );

  const team = strat.tags?.team?.toUpperCase() || "JR";
  const type = strat.tags?.type === "tournament" ? "Tournament" : "Friendly";
  document.getElementById("strats-acc-tags-value")?.replaceChildren(
    document.createTextNode(`${team} · ${type}`)
  );

  document.getElementById("strats-acc-notes-value")?.replaceChildren(
    document.createTextNode(truncateText(strat.notes, 32) || "None")
  );

  document.getElementById("strats-acc-match-value")?.replaceChildren(
    document.createTextNode(formatMatchSummary(strat.match))
  );
}

function collapseAccordionIfFilled(detailsId, { filled = false } = {}) {
  const details = document.getElementById(detailsId);
  if (!details || !filled) return;
  details.open = false;
}

export function bindAccordionAutoCollapse() {
  const titleInput = document.getElementById("strats-title");
  titleInput?.addEventListener("blur", () => {
    syncAccordionSummaries();
    collapseAccordionIfFilled("strats-acc-title", {
      filled: Boolean(titleInput.value.trim()),
    });
  });

  const notesInput = document.getElementById("strats-notes");
  notesInput?.addEventListener("blur", () => {
    syncAccordionSummaries();
    collapseAccordionIfFilled("strats-acc-notes", {
      filled: Boolean(notesInput.value.trim()),
    });
  });

  document.getElementById("strats-acc-tags")?.querySelectorAll("[data-team], [data-type]").forEach((button) => {
    button.addEventListener("click", () => {
      window.setTimeout(() => {
        syncAccordionSummaries();
        collapseAccordionIfFilled("strats-acc-tags", { filled: true });
      }, 0);
    });
  });

  const matchFields = [
    document.getElementById("strats-match-date"),
    document.getElementById("strats-match-opponent"),
    document.getElementById("strats-match-map"),
    document.getElementById("strats-match-starting-point"),
  ];
  matchFields.forEach((field) => {
    field?.addEventListener("blur", () => {
      syncAccordionSummaries();
      collapseAccordionIfFilled("strats-acc-match", {
        filled: formatMatchSummary(state.activeStrat?.match) !== "None",
      });
    });
  });

  document.getElementById("strats-acc-match")?.querySelectorAll("[data-faction], [data-result]").forEach((button) => {
    button.addEventListener("click", () => {
      window.setTimeout(() => {
        syncAccordionSummaries();
        collapseAccordionIfFilled("strats-acc-match", {
          filled: formatMatchSummary(state.activeStrat?.match) !== "None",
        });
      }, 0);
    });
  });
}

function renderStratMeta() {
  const hasStrat = Boolean(state.activeStrat);
  document.getElementById("strats-panel-empty")?.classList.toggle("hidden", hasStrat);
  document.getElementById("strats-workspace")?.classList.toggle("hidden", !hasStrat);
  renderStratsPicker();

  const detailsBtn = document.getElementById("btn-strats-details");
  detailsBtn?.classList.toggle("hidden", !hasStrat);
  if (!hasStrat) {
    setStratsPanelView("slides");
  }

  if (hasStrat) {
    setStratsPanelView(state.stratsPanelView);
  }

  if (!hasStrat) {
    setStratsToolsEnabled(false);
    setSaveStatus("");
    return;
  }

  setStratsToolsEnabled(!state.activeStrat.locked);

  const titleInput = document.getElementById("strats-title");
  if (titleInput && titleInput !== document.activeElement) {
    titleInput.value = state.activeStrat.title;
  }

  const notesInput = document.getElementById("strats-notes");
  if (notesInput && notesInput !== document.activeElement) {
    notesInput.value = state.activeStrat.notes || "";
  }

  updateTagBar("strats-team-bar", state.activeStrat.tags.team, "team");
  updateTagBar("strats-type-bar", state.activeStrat.tags.type, "type");

  ensureStratMatch(state.activeStrat, {
    defaultMapId: getActiveSlide(state.activeStrat, state.activeSlideId)?.mapId || state.currentMapId,
  });

  const match = state.activeStrat.match;
  const matchDateInput = document.getElementById("strats-match-date");
  if (matchDateInput && matchDateInput !== document.activeElement) {
    matchDateInput.value = match.date || "";
  }

  const matchOpponentInput = document.getElementById("strats-match-opponent");
  if (matchOpponentInput && matchOpponentInput !== document.activeElement) {
    matchOpponentInput.value = match.opponent || "";
  }

  const matchMapSelect = document.getElementById("strats-match-map");
  if (matchMapSelect && matchMapSelect !== document.activeElement) {
    if (!match.mapId) {
      match.mapId = getActiveSlide(state.activeStrat, state.activeSlideId)?.mapId || state.currentMapId || "";
    }
    matchMapSelect.value = match.mapId || "";
  }

  populateMatchStartingPointSelect(match.mapId, match.startingPoint);

  updateTagBar("strats-faction-bar", match.faction || "", "faction");
  updateTagBar("strats-result-bar", match.result || "", "result");

  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  const slideEditor = document.getElementById("strats-slide-editor");
  slideEditor?.classList.toggle("hidden", !slide);

  const slideNameInput = document.getElementById("strats-slide-name");
  if (slideNameInput && slide && slideNameInput !== document.activeElement) {
    slideNameInput.value = slide.name;
  }

  const mapSelect = document.getElementById("strats-slide-map");
  if (mapSelect && slide) {
    mapSelect.value = slide.mapId || state.currentMapId;
  }

  const countEl = document.getElementById("strats-slides-count");
  if (countEl) {
    const count = state.activeStrat.slides.length;
    countEl.textContent = `${count} slide${count === 1 ? "" : "s"}`;
  }

  syncAccordionSummaries();
}

export function renderStratsChrome() {
  renderStratMeta();
  renderSlidesList();
  syncStratsMapChrome();
}

function syncStratsMapChrome() {
  const show = state.appMode === "strats" && Boolean(state.activeStrat);
  document.getElementById("strats-draw-layer")?.classList.toggle("hidden", !show);
  document.getElementById("strats-draw-preview")?.classList.toggle("hidden", !show);
  document.getElementById("strats-handles-layer")?.classList.toggle("hidden", !show);
}

export async function reloadStratsCatalog() {
  const data = await fetchStratsCatalog();
  state.stratsCatalog = data.strats || [];
  renderStratsPicker();
}

export function populateSlideMapSelect() {
  const select = document.getElementById("strats-slide-map");
  if (!select || select.options.length > 0) return;

  for (const map of state.mapCatalog) {
    const option = document.createElement("option");
    option.value = map.id;
    option.textContent = map.name;
    select.appendChild(option);
  }
}

export function populateMatchMapSelect() {
  const select = document.getElementById("strats-match-map");
  if (!select || select.options.length > 0) return;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select map…";
  select.appendChild(placeholder);

  for (const map of state.mapCatalog) {
    const option = document.createElement("option");
    option.value = map.id;
    option.textContent = map.name;
    select.appendChild(option);
  }
}

export function populateMatchStartingPointSelect(mapId, selectedId = "") {
  const select = document.getElementById("strats-match-starting-point");
  if (!select) return;

  const currentValue = select === document.activeElement ? select.value : selectedId;
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select starting point…";
  select.appendChild(placeholder);

  for (const midpoint of getMidpointsForMap(mapId)) {
    const option = document.createElement("option");
    option.value = midpoint.id;
    option.textContent = midpoint.label;
    select.appendChild(option);
  }

  if (currentValue && isValidStartingPoint(mapId, currentValue)) {
    select.value = currentValue;
  } else {
    select.value = "";
    if (state.activeStrat?.match) {
      state.activeStrat.match.startingPoint = "";
    }
  }
}

export function bindTagBar(barId, attrName, onChange) {
  const bar = document.getElementById(barId);
  bar?.querySelectorAll(`[data-${attrName}]`).forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.activeStrat) return;
      onChange(button.dataset[attrName]);
      updateTagBar(barId, button.dataset[attrName], attrName);
      scheduleSave();
    });
  });
}

export function canDeleteStratFromOpenList() {
  return getCurrentUser()?.role === "owner";
}

export function bindStratDeleteConfirmDialog() {
  const dialog = document.getElementById("strats-delete-confirm-dialog");
  const confirmBtn = document.getElementById("btn-strats-delete-confirm");
  const cancelBtn = document.getElementById("btn-strats-delete-cancel");
  if (!dialog) return;

  const finish = (confirmed) => {
    const resolver = getStratDeleteConfirmResolver();
    if (!resolver) return;
    dialog.close();
    setStratDeleteConfirmResolver(null);
    resolver(confirmed);
  };

  confirmBtn?.addEventListener("click", () => finish(true));
  cancelBtn?.addEventListener("click", () => finish(false));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    finish(false);
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      finish(false);
    }
  });
}

export function confirmStratDelete(strat) {
  const dialog = document.getElementById("strats-delete-confirm-dialog");
  const message = document.getElementById("strats-delete-confirm-message");
  if (!dialog || !message || !strat) {
    return Promise.resolve(false);
  }

  message.textContent = `Delete "${strat.title}"? This cannot be undone.`;
  return new Promise((resolve) => {
    setStratDeleteConfirmResolver(resolve);
    dialog.showModal();
  });
}

export async function deleteStratFromCatalog(strat) {
  if (!strat) return false;
  const confirmed = await confirmStratDelete(strat);
  if (!confirmed) return false;

  try {
    await apiDeleteStrat(strat.id);
    state.stratsCatalog = state.stratsCatalog.filter((entry) => entry.id !== strat.id);
    if (state.activeStrat?.id === strat.id) {
      await closeStratEditor();
    }
    renderStratsPicker();
    setSaveStatus("Deleted");
    return true;
  } catch (error) {
    setSaveStatus(error.message || "Delete failed", { error: true });
    return false;
  }
}
