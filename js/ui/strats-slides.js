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
import { renderStratThumbnail } from "../strats/strat-draw-render.js";
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
} from "./strats-editor.js";
import { renderStratsPicker } from "./strats-picker.js";

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
    if (getSlideDragId() === slide.id) {
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
      setSlideDragId(slide.id);
      event.dataTransfer?.setData("text/plain", slide.id);
      event.dataTransfer.effectAllowed = "move";
      item.classList.add("is-dragging");
    });

    item.addEventListener("dragend", () => {
      setSlideDragId(null);
      item.classList.remove("is-dragging");
      list.querySelectorAll(".strats-slides__item.is-drop-target").forEach((entry) => {
        entry.classList.remove("is-drop-target");
      });
    });

    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      const currentDragId = getSlideDragId();
      if (currentDragId && currentDragId !== slide.id) {
        item.classList.add("is-drop-target");
      }
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("is-drop-target");
    });

    item.addEventListener("drop", (event) => {
      event.preventDefault();
      item.classList.remove("is-drop-target");
      const sourceId = event.dataTransfer?.getData("text/plain") || getSlideDragId();
      if (sourceId) {
        reorderSlidesByDrag(sourceId, slide.id);
      }
      setSlideDragId(null);
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
