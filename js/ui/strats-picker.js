import { state } from "../state.js";
import { getCurrentUser } from "../api/auth.js";
import {
  getStratsPickerOpen,
  setStratsPickerOpenValue,
  escapeHtml,
} from "./strats-state.js";
import { openStrat, canDeleteStratFromOpenList, deleteStratFromCatalog } from "./strats-editor.js";

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

export function setStratsPickerOpen(open) {
  setStratsPickerOpenValue(open);
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

export function renderStratsPickerTrigger() {
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

export function renderStratsPickerList() {
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

export function renderStratsPicker() {
  renderStratsPickerTrigger();
  if (getStratsPickerOpen()) {
    renderStratsPickerList();
  }
}
