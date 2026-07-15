import { state } from "../state.js";
import { assetUrl } from "../helpers/asset-url.js";
import {
  getActiveSlide,
  ensureStratMatch,
} from "../helpers/strat-defaults.js";
import {
  getMidpointsForMap,
  getStartingPointLabel,
  isValidStartingPoint,
} from "../helpers/map-midpoints.js";
import { fetchStratsCatalog } from "../api/strats.js";
import { normalizeStratObjects } from "../strats/strat-object-schema.js";
import {
  clearStratsDirty,
  discardStratsUnsavedChanges,
  hasStratsUnsavedChanges,
} from "../helpers/strats-unsaved.js";
import { setStratsToolsEnabled } from "./strats-tools.js";
import { clearDrawLayer, refreshDrawLayer, resetStratDrawingHistory } from "../strats/strat-drawing.js";
import {
  STRAT_UI_PREFS_KEY,
  getSwitchMapCallback,
  getMapName,
  escapeHtml,
} from "./strats-state.js";
import { setStratsPickerOpen, renderStratsPicker } from "./strats-picker.js";
import { renderSlidesList } from "./strats-slides.js";
import { syncAccordionSummaries, formatMatchSummary, updateTagBar } from "./strats-editor.js";
import { setSaveStatus } from "./strats-save.js";

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

function setStratsPanelView(view) {
  const nextView = view === "details" ? "details" : "slides";
  state.stratsPanelView = nextView;

  document.getElementById("strats-view-slides")?.classList.toggle("hidden", nextView !== "slides");
  document.getElementById("strats-view-details")?.classList.toggle("hidden", nextView !== "details");

  const detailsBtn = document.getElementById("btn-strats-details");
  detailsBtn?.classList.toggle("is-active", nextView === "details");
  detailsBtn?.setAttribute("aria-pressed", String(nextView === "details"));
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

function renderStratsChrome() {
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
    const cb = getSwitchMapCallback();
    await cb?.(slide.mapId, { fit: false });
  }
  await syncStratSlideMapImage(slide, { fit: true });
  refreshDrawLayer();
  renderStratsChrome();
}

export {
  loadStratUiPrefs,
  saveStratUiPrefs,
  setStratsPanelView,
  renderStratsChrome,
  syncStratsMapChrome,
  reloadStratsCatalog,
  populateSlideMapSelect,
  populateMatchMapSelect,
  populateMatchStartingPointSelect,
  bindTagBar,
  openStrat,
  activateCurrentSlideMap,
};
