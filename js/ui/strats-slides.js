import { state } from "../state.js";
import {
  getActiveSlide,
  sortSlides,
  createStrat,
  createSlide,
} from "../helpers/strat-defaults.js";
import { normalizeStratObjects } from "../strats/strat-object-schema.js";
import {
  createStrat as apiCreateStrat,
  duplicateSlide as apiDuplicateSlide,
} from "../api/strats.js";
import {
  getSlideDragId,
  setSlideDragId,
  getMapName,
  escapeHtml,
} from "./strats-state.js";
import {
  renderStratsChrome,
  scheduleSave,
  setSaveStatus,
  activateCurrentSlideMap,
  getSlideMapImage,
  openStrat,
  reloadStratsCatalog,
  saveStratUiPrefs,
} from "./strats-chrome.js";
import { renderStratsPicker } from "./strats-picker.js";
import { renderSlidesList } from "./strats-slides-list.js";

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
    const fullDraft = {
      ...draft,
      slides: [{
        ...createSlide({
          mapId: sourceSlide.mapId,
          order: 0,
          name: `${sourceSlide.name} (copy)`,
        }),
        objects: normalizeStratObjects(structuredClone(sourceSlide.objects || [])).map((object) => ({
          ...object,
          id: `obj-${crypto.randomUUID()}`,
        })),
      }],
    };

    const created = await apiCreateStrat(fullDraft);
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

export {
  setActiveSlideName,
  moveSlide,
  openDuplicateSlideDialog,
  renderDuplicateTargetList,
  duplicateSlideToNewStrat,
  duplicateSlideToStrat,
  navigateSlide,
  reorderSlidesByDrag,
  startInlineSlideRename,
  renderSlidesList,
};
