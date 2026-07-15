import { state } from "../state.js";
import { createStrat, createSlide, getStratDefaultSlideMapId, getActiveSlide, ensureStratMatch } from "../helpers/strat-defaults.js";
import { isValidStartingPoint } from "../helpers/map-midpoints.js";
import { createStrat as apiCreateStrat, duplicateStrat as apiDuplicateStrat } from "../api/strats.js";
import { hasStratsUnsavedChanges, discardStratsUnsavedChanges } from "../helpers/strats-unsaved.js";
import { hasStratsObjectSelection } from "../strats/strat-drawing.js";
import { getStratsPickerOpen } from "./strats-state.js";
import { setStratsPickerOpen, renderStratsPicker, renderStratsPickerList, renderStratsPickerTrigger } from "./strats-picker.js";
import {
  setStratsPanelView,
  setSaveStatus,
  openStrat,
  closeStratEditor,
  scheduleSave,
  bindTagBar,
  bindAccordionAutoCollapse,
  bindStratDeleteConfirmDialog,
  deleteStratFromCatalog,
  populateMatchStartingPointSelect,
  renderStratsChrome,
  syncAccordionSummaries,
  activateCurrentSlideMap,
} from "./strats-editor.js";
import { resetImportDialog, submitStratSketchImport, queueImportPreview } from "./strats-import.js";
import {
  navigateSlide,
  duplicateSlideToNewStrat,
  renderDuplicateTargetList,
  setActiveSlideName,
  renderSlidesList,
} from "./strats-slides.js";

export function bindStratsUi() {
  bindStratDeleteConfirmDialog();

  document.getElementById("strats-picker-trigger")?.addEventListener("click", (event) => {
    event.stopPropagation();
    setStratsPickerOpen(!getStratsPickerOpen());
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
    const isOpen = getStratsPickerOpen();
    if (!isOpen) return;
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
    if (event.key === "Escape" && getStratsPickerOpen()) {
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
