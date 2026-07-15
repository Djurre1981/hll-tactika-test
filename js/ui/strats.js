import { state } from "../state.js";
import { assetUrl } from "../helpers/asset-url.js";
import {
  createStrat,
  createSlide,
  ensureStratMatch,
  getActiveSlide,
  getStratDefaultSlideMapId,
  sortSlides,
} from "../helpers/strat-defaults.js";
import {
  getMidpointsForMap,
  getStartingPointLabel,
  isValidStartingPoint,
  loadMapMidpoints,
} from "../helpers/map-midpoints.js";
import {
  createStrat as apiCreateStrat,
  deleteStrat as apiDeleteStrat,
  duplicateSlide as apiDuplicateSlide,
  duplicateStrat as apiDuplicateStrat,
  fetchStratsCatalog,
  updateStrat as apiUpdateStrat,
} from "../api/strats.js";
import { getCurrentUser } from "../api/auth.js";
import { initStratsTools, setStratsToolsEnabled, syncStratsToolsUi, handleStratsSelectionChange } from "./strats-tools.js";
import {
  clearDrawLayer,
  hasStratsObjectSelection,
  initStratDrawing,
  refreshDrawLayer,
  resetStratDrawingHistory,
} from "../strats/strat-drawing.js";
import { renderStratThumbnail } from "../strats/strat-draw-render.js";
import { normalizeStratObjects } from "../strats/strat-object-schema.js";
import { importStratSketchBriefing, parseStratSketchCode, fetchStratSketchImportMetadata } from "../strats/stratsketch-import.js";

import {
  clearStratsDirty,
  confirmStratsUnsavedAction,
  discardStratsUnsavedChanges,
  hasStratsUnsavedChanges,
  scheduleStratsAutosave,
} from "../helpers/strats-unsaved.js";

function getMapName(mapId) {
  return state.mapCatalog.find((map) => map.id === mapId)?.name || mapId;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setImportStatus(message, { error = false } = {}) {
  const status = document.getElementById("strats-import-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", error);
}

function resetImportDialog() {
  setImportStatus("");
  setImportPreview(null);
  const titleInput = document.getElementById("strats-import-title");
  if (titleInput) titleInput.value = "";
}

function setImportPreview(metadata) {
  const preview = document.getElementById("strats-import-preview");
  if (!preview) return;
  if (!metadata) {
    preview.textContent = "";
    preview.classList.add("hidden");
    return;
  }

  const lines = [];
  if (metadata.name) lines.push(`Title: ${metadata.name}`);
  if (metadata.creatorUsername) lines.push(`Creator: ${metadata.creatorUsername}`);
  if (metadata.createdAt) {
    const date = new Date(metadata.createdAt);
    if (!Number.isNaN(date.getTime())) {
      lines.push(`Created: ${date.toLocaleString()}`);
    }
  }
  if (metadata.slideCount) lines.push(`Slides: ${metadata.slideCount}`);

  if (!lines.length) {
    preview.textContent = "";
    preview.classList.add("hidden");
    return;
  }

  preview.textContent = lines.join(" · ");
  preview.classList.remove("hidden");
}

function buildStratSketchImportNotes(metadata = {}) {
  const lines = [];
  if (metadata.creatorUsername) {
    lines.push(`StratSketch creator: ${metadata.creatorUsername}`);
  }
  if (metadata.createdAt) {
    lines.push(`StratSketch created: ${metadata.createdAt}`);
  }
  if (metadata.code) {
    lines.push(`StratSketch code: ${metadata.code}`);
  }
  return lines.join("\n");
}

function buildStratSketchImportSource(metadata = {}) {
  return {
    type: "stratsketch",
    code: metadata.code || null,
    revision: metadata.revision ?? null,
    importMode: "png",
    ssTitle: metadata.name || null,
    ssCreator: metadata.creatorUsername || null,
    ssCreatedAt: metadata.createdAt || null,
  };
}

let importPreviewTimer = null;

async function queueImportPreview(url) {
  clearTimeout(importPreviewTimer);
  const code = parseStratSketchCode(url);
  if (!code) {
    setImportPreview(null);
    return;
  }

  importPreviewTimer = setTimeout(async () => {
    try {
      const { metadata } = await fetchStratSketchImportMetadata(url);
      setImportPreview(metadata);
      const titleInput = document.getElementById("strats-import-title");
      if (titleInput && !titleInput.value.trim() && metadata?.name) {
        titleInput.placeholder = metadata.name;
      }
    } catch {
      setImportPreview(null);
    }
  }, 350);
}

async function submitStratSketchImport(event) {
  event.preventDefault();
  const urlInput = document.getElementById("strats-import-url");
  const titleInput = document.getElementById("strats-import-title");
  const submitButton = document.getElementById("btn-strats-import-submit");
  const url = urlInput?.value?.trim() || "";
  if (!url) return;

  if (hasStratsUnsavedChanges()) {
    if (!window.confirm("Discard unsaved changes and import a StratSketch briefing?")) return;
    discardStratsUnsavedChanges();
  }

  submitButton?.setAttribute("disabled", "true");
  setImportStatus("Loading briefing from StratSketch…");

  try {
    const result = await importStratSketchBriefing(url, {
      defaultMapId: state.currentMapId,
      mapCatalog: state.mapCatalog,
      title: titleInput?.value?.trim(),
      onStatus: setImportStatus,
    });

    if (result.mode === "server") {
      state.stratsCatalog.push(result.strat);
      await openStrat(result.strat);
      renderStratsPicker();
      setSaveStatus("Imported");
      document.getElementById("strats-import-dialog")?.close();
      resetImportDialog();
      return;
    }

    const converted = result.converted;
    const titleOverride = titleInput?.value?.trim();
    const draft = createStrat({
      title: titleOverride || converted.title,
      team: converted.tags?.team,
      type: converted.tags?.type,
      mapId: converted.slides[0]?.mapId || state.currentMapId,
    });
    const created = await apiCreateStrat({
      ...draft,
      title: titleOverride || converted.title,
      notes: buildStratSketchImportNotes(result.metadata),
      tags: converted.tags,
      slides: converted.slides,
      importSource: buildStratSketchImportSource(result.metadata),
    });

    state.stratsCatalog.push(created);
    await openStrat(created);
    renderStratsPicker();
    setSaveStatus("Imported");
    document.getElementById("strats-import-dialog")?.close();
    resetImportDialog();
  } catch (error) {
    setImportStatus(error.message || "Import failed", { error: true });
  } finally {
    submitButton?.removeAttribute("disabled");
  }
}

function setSaveStatus(message, { error = false } = {}) {
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

function saveStratUiPrefs(stratId, { slideId } = {}) {
  if (!stratId) return;
  const prefs = loadStratUiPrefs();
  prefs[stratId] = {
    slideId: slideId ?? prefs[stratId]?.slideId ?? null,
  };
  localStorage.setItem(STRAT_UI_PREFS_KEY, JSON.stringify(prefs));
}

const STRAT_UI_PREFS_KEY = "hll-tactika-strat-ui-prefs";
let slideDragId = null;
let stratsPickerOpen = false;

export {
  confirmStratsUnsavedAction,
  discardStratsUnsavedChanges,
  hasStratsUnsavedChanges,
};

function filterStratsBySearch(strats, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return strats;
  return strats.filter((strat) => {
    const haystack = [
      strat.title,
      strat.tags?.team,
      strat.tags?.type,
      strat.notes,
      strat.match?.opponent,
      strat.match?.faction,
      strat.createdByName,
    ].join(" ").toLowerCase();
    return haystack.includes(needle);
  });
}

function setStratsPickerOpen(open) {
  stratsPickerOpen = open;
  const picker = document.getElementById("strats-picker");
  const menu = document.getElementById("strats-picker-menu");
  const trigger = document.getElementById("strats-picker-trigger");
  const closeBtn = document.getElementById("btn-strats-close-editor");
  const panelBody = document.getElementById("strats-panel-body");
  picker?.classList.toggle("is-open", open);
  panelBody?.classList.toggle("is-picker-open", open);
  menu?.classList.toggle("hidden", !open);
  trigger?.setAttribute("aria-expanded", String(open));
  closeBtn?.classList.toggle("hidden", !state.activeStrat);

  if (open) {
    const search = document.getElementById("strats-picker-search");
    if (search) {
      search.value = "";
    }
    renderStratsPickerList();
    window.setTimeout(() => search?.focus(), 0);
  }
}

function renderStratsPickerTrigger() {
  const label = document.getElementById("strats-picker-label");
  const meta = document.getElementById("strats-picker-meta");
  if (!label || !meta) return;

  if (!state.activeStrat) {
    label.textContent = "Select or create a strat…";
    meta.textContent = "";
    meta.classList.add("hidden");
    return;
  }

  const strat = state.activeStrat;
  label.textContent = strat.title || "Untitled Strat";
  const team = strat.tags?.team?.toUpperCase() || "JR";
  const type = strat.tags?.type === "tournament" ? "Tournament" : "Friendly";
  const slideCount = strat.slides?.length || 0;
  meta.textContent = `${team} · ${type} · ${slideCount} slide${slideCount === 1 ? "" : "s"}`;
  meta.classList.remove("hidden");
}

function renderStratsPickerList() {
  const list = document.getElementById("strats-picker-list");
  if (!list) return;

  const query = document.getElementById("strats-picker-search")?.value || "";
  const catalog = filterStratsBySearch(state.stratsCatalog, query);

  if (!state.stratsCatalog.length) {
    list.innerHTML = '<li class="strats-open__empty">No strats yet. Create one with +.</li>';
    return;
  }

  if (!catalog.length) {
    list.innerHTML = '<li class="strats-open__empty">No matching strats.</li>';
    return;
  }

  list.innerHTML = "";
  const sorted = [...catalog].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  for (const strat of sorted) {
    const item = document.createElement("li");
    item.className = "strats-open__item";
    const isActive = strat.id === state.activeStrat?.id;
    const showDelete = canDeleteStratFromOpenList();
    const team = strat.tags?.team?.toUpperCase() || "JR";
    const type = strat.tags?.type || "friendly";
    const slideCount = strat.slides?.length || 0;
    item.innerHTML = `
      <button type="button" class="strats-open__btn${isActive ? " is-current" : ""}${showDelete ? " strats-open__btn--deletable" : ""}" role="option" aria-selected="${isActive}">
        <span class="strats-open__title">${escapeHtml(strat.title || "Untitled Strat")}</span>
        <span class="strats-open__meta">${team} · ${type} · ${slideCount} slide${slideCount === 1 ? "" : "s"}</span>
        <span class="strats-open__meta">${escapeHtml(strat.createdByName || "Unknown")}</span>
      </button>
      ${showDelete ? `<button type="button" class="strats-open__delete" title="Delete strat" aria-label="Delete ${escapeHtml(strat.title || "Untitled Strat")}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>` : ""}
    `;
    item.querySelector(".strats-open__btn")?.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (strat.id === state.activeStrat?.id) {
        setStratsPickerOpen(false);
        return;
      }
      setStratsPickerOpen(false);
      await openStrat(strat);
    });
    item.querySelector(".strats-open__delete")?.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await deleteStratFromCatalog(strat);
    });
    list.appendChild(item);
  }
}

function renderStratsPicker() {
  renderStratsPickerTrigger();
  if (stratsPickerOpen) {
    renderStratsPickerList();
  }
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

let switchMapCallback = null;

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
    await switchMapCallback?.(state.currentMapId, { fit: false });
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

async function openStrat(strat) {
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

async function activateCurrentSlideMap() {
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  if (!slide) return;
  state.activeSlideId = slide.id;
  if (state.activeStrat) {
    saveStratUiPrefs(state.activeStrat.id, { slideId: slide.id });
  }
  slide.objects = normalizeStratObjects(slide.objects || []);
  if (slide.mapId && slide.mapId !== state.currentMapId) {
    await switchMapCallback?.(slide.mapId, { fit: false });
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

function syncAccordionSummaries() {
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

function bindAccordionAutoCollapse() {
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

function setActiveSlideName(name) {
  const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
  if (!slide) return;
  slide.name = String(name || "").trim() || "Untitled";
}

function moveSlide(slideId, delta) {
  if (!state.activeStrat) return;
  const slides = sortSlides(state.activeStrat.slides);
  const index = slides.findIndex((slide) => slide.id === slideId);
  const targetIndex = index + delta;
  if (index < 0 || targetIndex < 0 || targetIndex >= slides.length) {
    return;
  }

  [slides[index], slides[targetIndex]] = [slides[targetIndex], slides[index]];
  slides.forEach((slide, order) => {
    slide.order = order;
  });
  state.activeStrat.slides = slides;
  scheduleSave();
  renderSlidesList();
}

function openDuplicateSlideDialog(slideId) {
  state.pendingDuplicateSlideId = slideId;
  const search = document.getElementById("strats-duplicate-search");
  if (search) search.value = "";
  renderDuplicateTargetList();
  document.getElementById("strats-duplicate-slide-dialog")?.showModal();
}

function renderDuplicateTargetList() {
  const list = document.getElementById("strats-duplicate-target-list");
  if (!list) return;

  const query = document.getElementById("strats-duplicate-search")?.value || "";
  const catalog = filterStratsBySearch(state.stratsCatalog, query);

  if (!catalog.length) {
    list.innerHTML = '<li class="strats-open__empty">No matching strats.</li>';
    return;
  }

  list.innerHTML = "";
  const sorted = [...catalog].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  for (const strat of sorted) {
    const item = document.createElement("li");
    item.className = "strats-open__item";
    const isCurrent = strat.id === state.activeStrat?.id;
    item.innerHTML = `
      <button type="button" class="strats-open__btn${isCurrent ? " is-current" : ""}">
        <span class="strats-open__title">${escapeHtml(strat.title)}${isCurrent ? " (current)" : ""}</span>
        <span class="strats-open__meta">${strat.tags.team.toUpperCase()} · ${strat.slides.length} slide${strat.slides.length === 1 ? "" : "s"}</span>
      </button>
    `;
    item.querySelector("button")?.addEventListener("click", async () => {
      await duplicateSlideToStrat(strat.id);
    });
    list.appendChild(item);
  }
}

async function duplicateSlideToNewStrat() {
  const slideId = state.pendingDuplicateSlideId;
  if (!slideId || !state.activeStrat) return;

  const sourceSlide = state.activeStrat.slides.find((slide) => slide.id === slideId);
  if (!sourceSlide) return;

  document.getElementById("strats-duplicate-slide-dialog")?.close();

  try {
    const draft = createStrat({
      title: `${state.activeStrat.title} – ${sourceSlide.name}`,
      team: state.activeStrat.tags.team,
      type: state.activeStrat.tags.type,
      mapId: sourceSlide.mapId,
    });
    draft.slides = [{
      ...createSlide({
        mapId: sourceSlide.mapId,
        order: 0,
        name: `${sourceSlide.name} (copy)`,
      }),
      objects: normalizeStratObjects(structuredClone(sourceSlide.objects || [])).map((object) => ({
        ...object,
        id: `obj-${crypto.randomUUID()}`,
      })),
    }];

    const created = await apiCreateStrat(draft);
    state.stratsCatalog.push(created);
    state.pendingDuplicateSlideId = null;
    await openStrat(created);
    renderStratsPicker();
    setSaveStatus("New strat created from slide");
  } catch (error) {
    setSaveStatus(error.message || "Create failed", { error: true });
  }
}

async function duplicateSlideToStrat(targetStratId) {
  const slideId = state.pendingDuplicateSlideId;
  if (!slideId || !state.activeStrat) return;

  document.getElementById("strats-duplicate-slide-dialog")?.close();

  try {
    const sourceStratId = state.activeStrat.id;
    const result = await apiDuplicateSlide(sourceStratId, slideId, { targetStratId });

    if (targetStratId === state.activeStrat.id) {
      state.activeStrat.slides.push(result.slide);
      state.activeSlideId = result.slide.id;
      renderStratsChrome();
      setSaveStatus("Slide duplicated");
    } else {
      await reloadStratsCatalog();
      setSaveStatus("Slide duplicated to another strat");
    }
  } catch (error) {
    setSaveStatus(error.message || "Duplicate failed", { error: true });
  } finally {
    state.pendingDuplicateSlideId = null;
  }
}

function navigateSlide(delta) {
  if (!state.activeStrat) return;
  const slides = sortSlides(state.activeStrat.slides);
  const index = slides.findIndex((slide) => slide.id === state.activeSlideId);
  const target = slides[index + delta];
  if (!target) return;

  state.activeSlideId = target.id;
  saveStratUiPrefs(state.activeStrat.id, { slideId: target.id });
  renderStratsChrome();
  activateCurrentSlideMap();
}

function reorderSlidesByDrag(sourceId, targetId) {
  if (!state.activeStrat || sourceId === targetId) return;
  const slides = sortSlides(state.activeStrat.slides);
  const fromIndex = slides.findIndex((slide) => slide.id === sourceId);
  const toIndex = slides.findIndex((slide) => slide.id === targetId);
  if (fromIndex < 0 || toIndex < 0) return;

  const [moved] = slides.splice(fromIndex, 1);
  slides.splice(toIndex, 0, moved);
  slides.forEach((slide, order) => {
    slide.order = order;
  });
  state.activeStrat.slides = slides;
  scheduleSave();
  renderSlidesList();
}

function startInlineSlideRename(nameEl, slide) {
  if (!nameEl || nameEl.dataset.editing === "true") return;
  nameEl.dataset.editing = "true";
  nameEl.contentEditable = "true";
  nameEl.classList.add("is-editing");
  nameEl.focus();

  const range = document.createRange();
  range.selectNodeContents(nameEl);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  const finish = () => {
    nameEl.contentEditable = "false";
    nameEl.classList.remove("is-editing");
    delete nameEl.dataset.editing;
    const nextName = nameEl.textContent.trim() || "Untitled";
    slide.name = nextName;
    nameEl.textContent = nextName;
    if (state.activeSlideId === slide.id) {
      const slideNameInput = document.getElementById("strats-slide-name");
      if (slideNameInput && slideNameInput !== document.activeElement) {
        slideNameInput.value = nextName;
      }
    }
    scheduleSave();
  };

  nameEl.addEventListener("blur", finish, { once: true });
  nameEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      nameEl.blur();
    }
    if (event.key === "Escape") {
      nameEl.textContent = slide.name;
      nameEl.blur();
    }
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

function renderSlidesList() {
  const list = document.getElementById("strats-slides-list");
  if (!list) return;

  if (!state.activeStrat) {
    list.innerHTML = '<li class="strats-slides__empty">Open or create a strat to manage slides.</li>';
    document.getElementById("btn-strats-add-slide")?.setAttribute("disabled", "");
    return;
  }

  document.getElementById("btn-strats-add-slide")?.removeAttribute("disabled");
  list.innerHTML = "";

  const slides = sortSlides(state.activeStrat.slides);
  if (!slides.length) {
    list.innerHTML = '<li class="strats-slides__empty">No slides yet — add one to begin.</li>';
    return;
  }

  slides.forEach((slide, index) => {
    const item = document.createElement("li");
    item.className = "strats-slides__item";
    item.draggable = true;
    item.dataset.slideId = slide.id;
    if (slide.id === state.activeSlideId) {
      item.classList.add("is-active");
    }
    if (slideDragId === slide.id) {
      item.classList.add("is-dragging");
    }

    const isFirst = index === 0;
    const isLast = index === slides.length - 1;

    item.innerHTML = `
      <div class="strats-slides__order">
        <button type="button" class="strats-slides__action strats-slides__drag" data-action="drag" title="Drag to reorder" aria-label="Drag to reorder">
          <i class="fa-solid fa-grip-vertical" aria-hidden="true"></i>
        </button>
        <button type="button" class="strats-slides__action" data-action="up" title="Move up" aria-label="Move slide up"${isFirst ? " disabled" : ""}>
          <i class="fa-solid fa-chevron-up" aria-hidden="true"></i>
        </button>
        <button type="button" class="strats-slides__action" data-action="down" title="Move down" aria-label="Move slide down"${isLast ? " disabled" : ""}>
          <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
        </button>
      </div>
      <div class="strats-slides__thumb" aria-hidden="true"></div>
      <div class="strats-slides__meta">
        <span class="strats-slides__name">${escapeHtml(slide.name)}</span>
        <span class="strats-slides__map">${escapeHtml(getMapName(slide.mapId))}</span>
      </div>
      <div class="strats-slides__actions">
        <button type="button" class="strats-slides__action" data-action="duplicate" title="Duplicate to…" aria-label="Duplicate slide to another strat">
          <i class="fa-regular fa-copy" aria-hidden="true"></i>
        </button>
        <button type="button" class="strats-slides__action" data-action="delete" title="Delete slide" aria-label="Delete slide">
          <i class="fa-regular fa-trash-can" aria-hidden="true"></i>
        </button>
      </div>
    `;

    const thumb = item.querySelector(".strats-slides__thumb");
    if (thumb) {
      thumb.replaceChildren(renderStratThumbnail(slide.objects, getSlideMapImage(slide.mapId), {
        rasterUrl: slide.rasterUrl,
      }));
    }

    item.addEventListener("dragstart", (event) => {
      slideDragId = slide.id;
      event.dataTransfer?.setData("text/plain", slide.id);
      event.dataTransfer.effectAllowed = "move";
      item.classList.add("is-dragging");
    });

    item.addEventListener("dragend", () => {
      slideDragId = null;
      item.classList.remove("is-dragging");
      list.querySelectorAll(".strats-slides__item.is-drop-target").forEach((entry) => {
        entry.classList.remove("is-drop-target");
      });
    });

    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (slideDragId && slideDragId !== slide.id) {
        item.classList.add("is-drop-target");
      }
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("is-drop-target");
    });

    item.addEventListener("drop", (event) => {
      event.preventDefault();
      item.classList.remove("is-drop-target");
      const sourceId = event.dataTransfer?.getData("text/plain") || slideDragId;
      if (sourceId) {
        reorderSlidesByDrag(sourceId, slide.id);
      }
      slideDragId = null;
    });

    item.addEventListener("click", (event) => {
      if (event.target.closest("[data-action]")) return;
      state.activeSlideId = slide.id;
      saveStratUiPrefs(state.activeStrat.id, { slideId: slide.id });
      renderStratsChrome();
      activateCurrentSlideMap();
    });

    item.querySelector(".strats-slides__name")?.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      startInlineSlideRename(event.currentTarget, slide);
    });

    item.querySelector('[data-action="drag"]')?.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });

    item.querySelector('[data-action="up"]')?.addEventListener("click", (event) => {
      event.stopPropagation();
      moveSlide(slide.id, -1);
    });

    item.querySelector('[data-action="down"]')?.addEventListener("click", (event) => {
      event.stopPropagation();
      moveSlide(slide.id, 1);
    });

    item.querySelector('[data-action="duplicate"]')?.addEventListener("click", (event) => {
      event.stopPropagation();
      openDuplicateSlideDialog(slide.id);
    });

    item.querySelector('[data-action="delete"]')?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.activeStrat.slides.length <= 1) {
        setSaveStatus("A strat needs at least one slide", { error: true });
        return;
      }
      state.activeStrat.slides = state.activeStrat.slides.filter((entry) => entry.id !== slide.id);
      if (state.activeSlideId === slide.id) {
        state.activeSlideId = sortSlides(state.activeStrat.slides)[0]?.id || null;
      }
      renderStratsChrome();
      scheduleSave();
      activateCurrentSlideMap();
    });

    list.appendChild(item);
  });
}

function canDeleteStratFromOpenList() {
  return getCurrentUser()?.role === "owner";
}

let stratDeleteConfirmResolver = null;

function bindStratDeleteConfirmDialog() {
  const dialog = document.getElementById("strats-delete-confirm-dialog");
  const confirmBtn = document.getElementById("btn-strats-delete-confirm");
  const cancelBtn = document.getElementById("btn-strats-delete-cancel");
  if (!dialog) return;

  const finish = (confirmed) => {
    if (!stratDeleteConfirmResolver) return;
    dialog.close();
    const resolve = stratDeleteConfirmResolver;
    stratDeleteConfirmResolver = null;
    resolve(confirmed);
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

function confirmStratDelete(strat) {
  const dialog = document.getElementById("strats-delete-confirm-dialog");
  const message = document.getElementById("strats-delete-confirm-message");
  if (!dialog || !message || !strat) {
    return Promise.resolve(false);
  }

  message.textContent = `Delete "${strat.title}"? This cannot be undone.`;
  return new Promise((resolve) => {
    stratDeleteConfirmResolver = resolve;
    dialog.showModal();
  });
}

async function deleteStratFromCatalog(strat) {
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

async function reloadStratsCatalog() {
  const data = await fetchStratsCatalog();
  state.stratsCatalog = data.strats || [];
  renderStratsPicker();
}

function populateSlideMapSelect() {
  const select = document.getElementById("strats-slide-map");
  if (!select || select.options.length > 0) return;

  for (const map of state.mapCatalog) {
    const option = document.createElement("option");
    option.value = map.id;
    option.textContent = map.name;
    select.appendChild(option);
  }
}

function populateMatchMapSelect() {
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

function populateMatchStartingPointSelect(mapId, selectedId = "") {
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

function bindTagBar(barId, attrName, onChange) {
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

function bindStratsUi() {
  bindStratDeleteConfirmDialog();

  document.getElementById("strats-picker-trigger")?.addEventListener("click", (event) => {
    event.stopPropagation();
    setStratsPickerOpen(!stratsPickerOpen);
  });

  document.getElementById("strats-picker-search")?.addEventListener("input", () => {
    renderStratsPickerList();
  });

  document.getElementById("btn-strats-details")?.addEventListener("click", () => {
    if (!state.activeStrat) return;
    setStratsPickerOpen(false);
    setStratsPanelView(state.stratsPanelView === "details" ? "slides" : "details");
  });

  document.getElementById("btn-strats-back-slides")?.addEventListener("click", () => {
    setStratsPanelView("slides");
  });

  document.addEventListener("mousedown", (event) => {
    if (!stratsPickerOpen) return;
    const picker = document.getElementById("strats-picker");
    if (picker && event.target instanceof Node && !picker.contains(event.target)) {
      setStratsPickerOpen(false);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.stratsPanelView === "details") {
      setStratsPanelView("slides");
      return;
    }
    if (event.key === "Escape" && stratsPickerOpen) {
      setStratsPickerOpen(false);
    }
  });

  document.getElementById("btn-strats-new")?.addEventListener("click", async () => {
    if (hasStratsUnsavedChanges()) {
      if (!window.confirm("Discard unsaved changes and create a new strat?")) return;
      discardStratsUnsavedChanges();
    }
    setStratsPickerOpen(false);
    try {
      const draft = createStrat({ mapId: state.currentMapId });
      const created = await apiCreateStrat(draft);
      state.stratsCatalog.push(created);
      await openStrat(created);
      renderStratsPicker();
      setSaveStatus("Saved");
    } catch (error) {
      setSaveStatus(error.message || "Create failed", { error: true });
    }
  });

  document.getElementById("btn-strats-import")?.addEventListener("click", () => {
    resetImportDialog();
    const urlInput = document.getElementById("strats-import-url");
    const openLink = document.getElementById("strats-import-open-link");
    if (openLink && urlInput?.value?.trim()) {
      const code = urlInput.value.trim();
      openLink.href = code.includes("stratsketch.com") ? code : `https://stratsketch.com/${code}`;
    }
    document.getElementById("strats-import-dialog")?.showModal();
    urlInput?.focus();
  });

  document.getElementById("strats-import-form")?.addEventListener("submit", submitStratSketchImport);

  document.getElementById("strats-import-url")?.addEventListener("input", (event) => {
    queueImportPreview(event.target?.value || "");
  });

  document.getElementById("btn-strats-close-editor")?.addEventListener("click", () => {
    if (hasStratsUnsavedChanges()) {
      if (!window.confirm("Discard unsaved changes and close this strat?")) return;
      discardStratsUnsavedChanges();
    }
    setStratsPickerOpen(false);
    closeStratEditor();
  });

  document.getElementById("btn-strats-duplicate")?.addEventListener("click", async () => {
    if (!state.activeStrat) return;
    try {
      const duplicate = await apiDuplicateStrat(state.activeStrat.id);
      state.stratsCatalog.push(duplicate);
      await openStrat(duplicate);
      renderStratsPicker();
      setSaveStatus("Saved");
    } catch (error) {
      setSaveStatus(error.message || "Duplicate failed", { error: true });
    }
  });

  document.getElementById("btn-strats-delete")?.addEventListener("click", async () => {
    if (!state.activeStrat) return;
    await deleteStratFromCatalog(state.activeStrat);
  });

  document.getElementById("btn-strats-add-slide")?.addEventListener("click", () => {
    if (!state.activeStrat) return;
    const slide = createSlide({
      mapId: getStratDefaultSlideMapId(state.activeStrat, state.activeSlideId),
      order: state.activeStrat.slides.length,
      name: `Slide ${state.activeStrat.slides.length + 1}`,
    });
    state.activeStrat.slides.push(slide);
    state.activeSlideId = slide.id;
    renderStratsChrome();
    scheduleSave();
    document.getElementById("strats-slide-name")?.focus();
  });

  document.getElementById("strats-duplicate-search")?.addEventListener("input", () => {
    renderDuplicateTargetList();
  });

  document.getElementById("btn-strats-duplicate-new")?.addEventListener("click", () => {
    duplicateSlideToNewStrat();
  });

  window.addEventListener("keydown", (event) => {
    if (state.appMode !== "strats" || !state.activeStrat) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true'], dialog")) {
      return;
    }

    if (hasStratsObjectSelection()) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      navigateSlide(-1);
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      navigateSlide(1);
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (hasStratsUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  document.getElementById("strats-title")?.addEventListener("input", (event) => {
    if (!state.activeStrat) return;
    state.activeStrat.title = event.target.value;
    syncAccordionSummaries();
    renderStratsPickerTrigger();
    scheduleSave();
  });

  document.getElementById("strats-notes")?.addEventListener("input", (event) => {
    if (!state.activeStrat) return;
    state.activeStrat.notes = event.target.value;
    syncAccordionSummaries();
    scheduleSave();
  });

  document.getElementById("strats-match-date")?.addEventListener("input", (event) => {
    if (!state.activeStrat) return;
    ensureStratMatch(state.activeStrat);
    state.activeStrat.match.date = event.target.value;
    syncAccordionSummaries();
    scheduleSave();
  });

  document.getElementById("strats-match-opponent")?.addEventListener("input", (event) => {
    if (!state.activeStrat) return;
    ensureStratMatch(state.activeStrat);
    state.activeStrat.match.opponent = event.target.value;
    syncAccordionSummaries();
    scheduleSave();
  });

  document.getElementById("strats-match-map")?.addEventListener("change", (event) => {
    if (!state.activeStrat) return;
    ensureStratMatch(state.activeStrat);
    state.activeStrat.match.mapId = event.target.value;
    if (!isValidStartingPoint(state.activeStrat.match.mapId, state.activeStrat.match.startingPoint)) {
      state.activeStrat.match.startingPoint = "";
    }
    populateMatchStartingPointSelect(state.activeStrat.match.mapId, state.activeStrat.match.startingPoint);
    syncAccordionSummaries();
    scheduleSave();
  });

  document.getElementById("strats-match-starting-point")?.addEventListener("change", (event) => {
    if (!state.activeStrat) return;
    ensureStratMatch(state.activeStrat);
    state.activeStrat.match.startingPoint = event.target.value;
    syncAccordionSummaries();
    scheduleSave();
  });

  document.getElementById("strats-slide-name")?.addEventListener("input", (event) => {
    if (!state.activeStrat) return;
    setActiveSlideName(event.target.value);
    scheduleSave();
    renderSlidesList();
  });

  document.getElementById("strats-slide-map")?.addEventListener("change", (event) => {
    const slide = getActiveSlide(state.activeStrat, state.activeSlideId);
    if (!slide) return;
    slide.mapId = event.target.value;
    renderStratsChrome();
    scheduleSave();
    activateCurrentSlideMap();
  });

  bindTagBar("strats-team-bar", "team", (team) => {
    state.activeStrat.tags.team = team;
    syncAccordionSummaries();
  });

  bindTagBar("strats-type-bar", "type", (type) => {
    state.activeStrat.tags.type = type;
    syncAccordionSummaries();
  });

  bindTagBar("strats-faction-bar", "faction", (faction) => {
    ensureStratMatch(state.activeStrat);
    state.activeStrat.match.faction = faction;
    syncAccordionSummaries();
  });

  bindTagBar("strats-result-bar", "result", (result) => {
    ensureStratMatch(state.activeStrat);
    state.activeStrat.match.result = result;
    syncAccordionSummaries();
  });

  bindAccordionAutoCollapse();

  document.getElementById("btn-close-strats-import")?.addEventListener("click", () => {
    document.getElementById("strats-import-dialog")?.close();
    resetImportDialog();
  });

  document.getElementById("strats-import-dialog")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      event.currentTarget.close();
      resetImportDialog();
    }
  });

  document.getElementById("btn-close-strats-duplicate-slide")?.addEventListener("click", () => {
    state.pendingDuplicateSlideId = null;
    document.getElementById("strats-duplicate-slide-dialog")?.close();
  });

  document.getElementById("strats-duplicate-slide-dialog")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      state.pendingDuplicateSlideId = null;
      event.currentTarget.close();
    }
  });
}

export async function initStratsUi({ switchMap, mapViewer } = {}) {
  switchMapCallback = switchMap;
  await loadMapMidpoints();
  populateSlideMapSelect();
  populateMatchMapSelect();
  initStratsTools({
    onSettingsChange: () => {
      scheduleSave();
      renderSlidesList();
    },
  });
  bindStratsUi();
  syncStratsToolsUi();
  renderStratsChrome();

  if (mapViewer) {
    initStratDrawing(mapViewer, {
      onChange: () => {
        scheduleSave();
        renderSlidesList();
      },
      onSelect: handleStratsSelectionChange,
      onClipboard: () => syncStratsToolsUi(),
    });
  }

  try {
    await reloadStratsCatalog();
  } catch {
    state.stratsCatalog = [];
  }

  document.getElementById("btn-strats-new")?.removeAttribute("disabled");
  document.getElementById("btn-strats-import")?.removeAttribute("disabled");
}

export async function refreshStratsCatalog() {
  await reloadStratsCatalog();
}
