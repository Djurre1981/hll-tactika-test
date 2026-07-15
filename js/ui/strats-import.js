import { state } from "../state.js";
import { createStrat } from "../helpers/strat-defaults.js";
import { createStrat as apiCreateStrat } from "../api/strats.js";
import {
  importStratSketchBriefing,
  parseStratSketchCode,
  fetchStratSketchImportMetadata,
} from "../strats/stratsketch-import.js";
import {
  hasStratsUnsavedChanges,
  discardStratsUnsavedChanges,
} from "../helpers/strats-unsaved.js";
import {
  getImportPreviewTimer,
  setImportPreviewTimer,
} from "./strats-state.js";
import { setSaveStatus, openStrat } from "./strats-editor.js";
import { renderStratsPicker } from "./strats-picker.js";

function setImportStatus(message, { error = false } = {}) {
  const status = document.getElementById("strats-import-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", error);
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

export function resetImportDialog() {
  setImportStatus("");
  setImportPreview(null);
  const titleInput = document.getElementById("strats-import-title");
  if (titleInput) titleInput.value = "";
}

export async function queueImportPreview(url) {
  const prevTimer = getImportPreviewTimer();
  clearTimeout(prevTimer);
  const code = parseStratSketchCode(url);
  if (!code) {
    setImportPreview(null);
    return;
  }

  const timer = setTimeout(async () => {
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
  setImportPreviewTimer(timer);
}

export async function submitStratSketchImport(event) {
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
