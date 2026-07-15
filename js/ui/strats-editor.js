import { state } from "../state.js";
import { getActiveSlide, sortSlides, ensureStratMatch } from "../helpers/strat-defaults.js";
import { getStartingPointLabel } from "../helpers/map-midpoints.js";
import { deleteStrat as apiDeleteStrat } from "../api/strats.js";
import { getCurrentUser } from "../api/auth.js";
import { renderStratsPicker } from "./strats-picker.js";
import { renderStratsChrome, populateSlideMapSelect, populateMatchMapSelect, populateMatchStartingPointSelect, bindTagBar, activateCurrentSlideMap, openStrat } from "./strats-chrome.js";
import { setSaveStatus, scheduleSave, closeStratEditor, getSlideMapImage, syncStratSlideMapImage } from "./strats-save.js";
import { getStratDeleteConfirmResolver, setStratDeleteConfirmResolver } from "./strats-state.js";

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

function canDeleteStratFromOpenList() {
  return getCurrentUser()?.role === "owner";
}

function bindStratDeleteConfirmDialog() {
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

function confirmStratDelete(strat) {
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

export {
  updateTagBar,
  truncateText,
  formatMatchDateLabel,
  formatMatchSummary,
  syncAccordionSummaries,
  collapseAccordionIfFilled,
  bindAccordionAutoCollapse,
  canDeleteStratFromOpenList,
  bindStratDeleteConfirmDialog,
  confirmStratDelete,
  deleteStratFromCatalog,
};
