import { state } from "../state.js";
import { sortSlides } from "../helpers/strat-defaults.js";
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
  saveStratUiPrefs,
} from "./strats-save.js";
import {
  moveSlide,
  openDuplicateSlideDialog,
  reorderSlidesByDrag,
  startInlineSlideRename,
} from "./strats-slides.js";

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
  renderSlidesList,
};
