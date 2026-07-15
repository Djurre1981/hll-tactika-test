import { state } from "../state.js";
import {
  loadMapMidpoints,
} from "../helpers/map-midpoints.js";
import { fetchStratsCatalog } from "../api/strats.js";
import { initStratsTools, setStratsToolsEnabled, syncStratsToolsUi, handleStratsSelectionChange } from "./strats-tools.js";
import { initStratDrawing } from "../strats/strat-drawing.js";
import {
  clearStratsDirty,
  confirmStratsUnsavedAction,
  discardStratsUnsavedChanges,
  hasStratsUnsavedChanges,
} from "../helpers/strats-unsaved.js";
import {
  setSwitchMapCallback,
} from "./strats-state.js";
import { bindStratsUi } from "./strats-bind.js";
import {
  renderStratsChrome,
  populateSlideMapSelect,
  populateMatchMapSelect,
  reloadStratsCatalog,
  scheduleSave,
} from "./strats-editor.js";
import { renderSlidesList } from "./strats-slides.js";

export {
  confirmStratsUnsavedAction,
  discardStratsUnsavedChanges,
  hasStratsUnsavedChanges,
};

export async function initStratsUi({ switchMap, mapViewer } = {}) {
  setSwitchMapCallback(switchMap);
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
