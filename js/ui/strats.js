import { state } from "../state.js";
import {
  createStrat,
  createSlide,
  getActiveSlide,
  sortSlides,
} from "../helpers/strat-defaults.js";
import {
  createStrat as apiCreateStrat,
  deleteStrat as apiDeleteStrat,
  duplicateSlide as apiDuplicateSlide,
  duplicateStrat as apiDuplicateStrat,
  fetchStratsCatalog,
  updateStrat as apiUpdateStrat,
} from "../api/strats.js";
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

const STRAT_UI_PREFS_KEY = "hll-tactika-strat-ui-prefs";
let saveTimer = null;
let slideDragId = null;

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

function saveStratUiPrefs(stratId, { slideId, panelTab } = {}) {
  if (!stratId) return;
  const prefs = loadStratUiPrefs();
  prefs[stratId] = {
    slideId: slideId ?? prefs[stratId]?.slideId ?? null,
    panelTab: panelTab ?? prefs[stratId]?.panelTab ?? "strat",
  };
  localStorage.setItem(STRAT_UI_PREFS_KEY, JSON.stringify(prefs));
}

function markStratsDirty() {
  state.stratsDirty = true;
}

function clearStratsDirty() {
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
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  clearStratsDirty();
}

function filterStratsBySearch(strats, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return strats;
  return strats.filter((strat) => {
    const haystack = [
      strat.title,
      strat.tags?.team,
      strat.tags?.type,
      strat.notes,
    ].join(" ").toLowerCase();
    return haystack.includes(needle);
  });
}

function resolveImageSrc(imagePath) {
  return new URL(imagePath, window.location.href).href;
}

function getSlideMapImage(mapId) {
  const map = state.mapCatalog.find((entry) => entry.id === mapId);
  return map?.image ? resolveImageSrc(map.image) : "";
}

let switchMapCallback = null;

function scheduleSave() {
  if (!state.activeStrat) return;
  markStratsDirty();
  setSaveStatus("Unsaved changes…");
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveActiveStrat().catch((error) => {
      setSaveStatus(error.message || "Save failed", { error: true });
    });
  }, 700);
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
    renderStratsOpenList();
  } finally {
    state.stratsSaveInFlight = false;
  }
}

function closeStratEditor() {
  state.activeStrat = null;
  state.activeSlideId = null;
  state.pendingDuplicateSlideId = null;
  clearStratsDirty();
  resetStratDrawingHistory();
  clearDrawLayer();
  renderStratsChrome();
}

async function openStrat(strat) {
  if (hasStratsUnsavedChanges()) {
    if (!window.confirm("Discard unsaved changes and open this strat?")) {
      return;
    }
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    clearStratsDirty();
  }

  const prefs = loadStratUiPrefs()[strat.id];
  const slides = sortSlides(strat.slides);
  const preferredSlide = slides.find((slide) => slide.id === prefs?.slideId);

  state.activeStrat = structuredClone(strat);
  state.activeSlideId = preferredSlide?.id || slides[0]?.id || null;
  setStratsPanelTab(prefs?.panelTab === "slides" ? "slides" : "strat");
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
  refreshDrawLayer();
  if (slide.mapId && slide.mapId !== state.currentMapId) {
    await switchMapCallback?.(slide.mapId, { fit: true });
  }
  renderStratsChrome();
}

export function setStratsPanelTab(tab) {
  state.stratsPanelTab = tab;
  if (state.activeStrat) {
    saveStratUiPrefs(state.activeStrat.id, { panelTab: tab, slideId: state.activeSlideId });
  }
  const tabs = document.querySelector(".strats-panel__tabs-surface");
  tabs?.classList.toggle("is-slides", tab === "slides");

  document.querySelectorAll("[data-strats-tab]").forEach((button) => {
    const isActive = button.dataset.stratsTab === tab;
    button.setAttribute("aria-selected", String(isActive));
  });

  document.getElementById("strats-tab-strat")?.classList.toggle("hidden", tab !== "strat");
  document.getElementById("strats-tab-slides")?.classList.toggle("hidden", tab !== "slides");
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
    renderStratsOpenList();
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
      setStratsPanelTab("slides");
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

function renderPanelHeader() {
  const header = document.getElementById("strats-panel-header");
  const titleEl = document.getElementById("strats-panel-title");
  const chipsEl = document.getElementById("strats-panel-chips");
  const hasStrat = Boolean(state.activeStrat);

  header?.classList.toggle("hidden", !hasStrat);
  if (!hasStrat || !titleEl || !chipsEl) return;

  titleEl.textContent = state.activeStrat.title || "Untitled Strat";
  const team = state.activeStrat.tags?.team?.toUpperCase() || "JR";
  const type = state.activeStrat.tags?.type === "tournament" ? "Tournament" : "Friendly";
  chipsEl.textContent = `${team} · ${type}`;
}

function renderMapNav() {
  const nav = document.getElementById("strats-map-nav");
  const label = document.getElementById("strats-map-nav-label");
  const prevBtn = document.getElementById("btn-strats-slide-prev");
  const nextBtn = document.getElementById("btn-strats-slide-next");
  const show = state.appMode === "strats" && state.activeStrat;

  nav?.classList.toggle("hidden", !show);
  if (!show) return;

  const slides = sortSlides(state.activeStrat.slides);
  const index = slides.findIndex((slide) => slide.id === state.activeSlideId);
  const current = index >= 0 ? index + 1 : 1;

  if (label) {
    label.textContent = `Slide ${current} / ${slides.length || 1}`;
  }

  prevBtn?.toggleAttribute("disabled", index <= 0);
  nextBtn?.toggleAttribute("disabled", index < 0 || index >= slides.length - 1);
}

function navigateSlide(delta) {
  if (!state.activeStrat) return;
  const slides = sortSlides(state.activeStrat.slides);
  const index = slides.findIndex((slide) => slide.id === state.activeSlideId);
  const target = slides[index + delta];
  if (!target) return;

  state.activeSlideId = target.id;
  saveStratUiPrefs(state.activeStrat.id, { slideId: target.id, panelTab: "slides" });
  setStratsPanelTab("slides");
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
  document.getElementById("strats-editor-panel")?.classList.toggle("hidden", !hasStrat);
  renderPanelHeader();
  renderMapNav();

  if (!hasStrat) {
    setStratsToolsEnabled(false);
    setSaveStatus("");
    setStratsPanelTab("strat");
    document.querySelector('[data-strats-tab="slides"]')?.replaceChildren(document.createTextNode("Slides"));
    document.querySelector('[data-strats-tab="strat"]')?.removeAttribute("disabled");
    document.querySelector('[data-strats-tab="slides"]')?.toggleAttribute("disabled", true);
    return;
  }

  setStratsToolsEnabled(!state.activeStrat.locked);
  setStratsPanelTab(state.stratsPanelTab);

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

  const slidesTab = document.querySelector('[data-strats-tab="slides"]');
  if (slidesTab) {
    const count = state.activeStrat.slides.length;
    slidesTab.textContent = count > 0 ? `Slides (${count})` : "Slides";
  }

  document.querySelectorAll("[data-strats-tab]").forEach((button) => {
    button.toggleAttribute("disabled", button.dataset.stratsTab === "slides" && !hasStrat);
  });

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
        <span class="strats-slides__index">${index + 1}</span>
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
      thumb.replaceChildren(renderStratThumbnail(slide.objects, getSlideMapImage(slide.mapId)));
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
      saveStratUiPrefs(state.activeStrat.id, { slideId: slide.id, panelTab: "slides" });
      setStratsPanelTab("slides");
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

function renderStratsOpenList() {
  const list = document.getElementById("strats-open-list");
  if (!list) return;

  const query = document.getElementById("strats-open-search")?.value || "";
  const catalog = filterStratsBySearch(state.stratsCatalog, query);

  if (!state.stratsCatalog.length) {
    list.innerHTML = '<li class="strats-open__empty">No strats yet. Create one to get started.</li>';
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
    item.innerHTML = `
      <button type="button" class="strats-open__btn">
        <span class="strats-open__title">${escapeHtml(strat.title)}</span>
        <span class="strats-open__meta">${strat.tags.team.toUpperCase()} · ${strat.tags.type} · ${strat.slides.length} slide${strat.slides.length === 1 ? "" : "s"}</span>
        <span class="strats-open__meta">${escapeHtml(strat.createdByName || "Unknown")}</span>
      </button>
    `;
    item.querySelector("button")?.addEventListener("click", async () => {
      document.getElementById("strats-open-dialog")?.close();
      await openStrat(strat);
    });
    list.appendChild(item);
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
  document.getElementById("strats-map-nav")?.classList.toggle("hidden", !show);
}

async function reloadStratsCatalog() {
  const data = await fetchStratsCatalog();
  state.stratsCatalog = data.strats || [];
  renderStratsOpenList();
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
  document.querySelectorAll("[data-strats-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.activeStrat && button.dataset.stratsTab !== "strat") return;
      setStratsPanelTab(button.dataset.stratsTab);
    });
  });

  document.getElementById("btn-strats-new")?.addEventListener("click", async () => {
    if (hasStratsUnsavedChanges()) {
      if (!window.confirm("Discard unsaved changes and create a new strat?")) return;
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      clearStratsDirty();
    }
    try {
      const draft = createStrat({ mapId: state.currentMapId });
      const created = await apiCreateStrat(draft);
      state.stratsCatalog.push(created);
      await openStrat(created);
      renderStratsOpenList();
      setSaveStatus("Saved");
    } catch (error) {
      setSaveStatus(error.message || "Create failed", { error: true });
    }
  });

  document.getElementById("btn-strats-open")?.addEventListener("click", () => {
    renderStratsOpenList();
    document.getElementById("strats-open-dialog")?.showModal();
  });

  document.getElementById("btn-strats-close-editor")?.addEventListener("click", () => {
    if (hasStratsUnsavedChanges()) {
      if (!window.confirm("Discard unsaved changes and close this strat?")) return;
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      clearStratsDirty();
    }
    closeStratEditor();
  });

  document.getElementById("btn-strats-duplicate")?.addEventListener("click", async () => {
    if (!state.activeStrat) return;
    try {
      const duplicate = await apiDuplicateStrat(state.activeStrat.id);
      state.stratsCatalog.push(duplicate);
      await openStrat(duplicate);
      renderStratsOpenList();
      setSaveStatus("Saved");
    } catch (error) {
      setSaveStatus(error.message || "Duplicate failed", { error: true });
    }
  });

  document.getElementById("btn-strats-delete")?.addEventListener("click", async () => {
    if (!state.activeStrat) return;
    if (!window.confirm(`Delete "${state.activeStrat.title}"?`)) return;
    try {
      await apiDeleteStrat(state.activeStrat.id);
      state.stratsCatalog = state.stratsCatalog.filter((strat) => strat.id !== state.activeStrat.id);
      closeStratEditor();
      renderStratsOpenList();
    } catch (error) {
      setSaveStatus(error.message || "Delete failed", { error: true });
    }
  });

  document.getElementById("btn-strats-add-slide")?.addEventListener("click", () => {
    if (!state.activeStrat) return;
    const slide = createSlide({
      mapId: getActiveSlide(state.activeStrat, state.activeSlideId)?.mapId || state.currentMapId,
      order: state.activeStrat.slides.length,
      name: `Slide ${state.activeStrat.slides.length + 1}`,
    });
    state.activeStrat.slides.push(slide);
    state.activeSlideId = slide.id;
    setStratsPanelTab("slides");
    renderStratsChrome();
    scheduleSave();
    document.getElementById("strats-slide-name")?.focus();
  });

  document.getElementById("strats-open-search")?.addEventListener("input", () => {
    renderStratsOpenList();
  });

  document.getElementById("strats-duplicate-search")?.addEventListener("input", () => {
    renderDuplicateTargetList();
  });

  document.getElementById("btn-strats-duplicate-new")?.addEventListener("click", () => {
    duplicateSlideToNewStrat();
  });

  document.getElementById("btn-strats-slide-prev")?.addEventListener("click", () => navigateSlide(-1));
  document.getElementById("btn-strats-slide-next")?.addEventListener("click", () => navigateSlide(1));

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
    renderPanelHeader();
    scheduleSave();
  });

  document.getElementById("strats-notes")?.addEventListener("input", (event) => {
    if (!state.activeStrat) return;
    state.activeStrat.notes = event.target.value;
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

  bindAccordionAutoCollapse();

  document.getElementById("btn-close-strats-open")?.addEventListener("click", () => {
    document.getElementById("strats-open-dialog")?.close();
  });

  document.getElementById("strats-open-dialog")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      event.currentTarget.close();
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
  populateSlideMapSelect();
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
  document.getElementById("btn-strats-open")?.removeAttribute("disabled");
}

export async function refreshStratsCatalog() {
  await reloadStratsCatalog();
}
