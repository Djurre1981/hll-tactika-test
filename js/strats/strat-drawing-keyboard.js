import { state } from "../state.js";
import {
  getSelectedObjectId,
  setSelectedObject,
  getClipboardObject,
} from "./strat-drawing-state.js";
import {
  copySelectedObject,
  cutSelectedObject,
  pasteClipboardObject,
} from "./strat-drawing-clipboard.js";
import {
  isStratsEditingBlocked,
} from "./strat-drawing-pointer.js";
import {
  duplicateSelectedObject,
  reorderSelectedObject,
  nudgeSelectedObject,
  undoStratEdit,
  redoStratEdit,
  removeObject,
} from "./strat-drawing.js";

function isTypingTarget(target) {
  return target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']");
}

function handleKeyDown(event) {
  if (state.appMode !== "strats" || !state.activeStrat) return;
  if (isTypingTarget(event.target)) return;

  const key = event.key.toLowerCase();

  if (key === "escape") {
    if (getSelectedObjectId()) {
      setSelectedObject(null);
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "c" && getSelectedObjectId()) {
    event.preventDefault();
    copySelectedObject();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "x" && getSelectedObjectId()) {
    event.preventDefault();
    cutSelectedObject();
    getOnObjectsChanged()?.();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "v") {
    if (getClipboardObject() && !isStratsEditingBlocked()) {
      event.preventDefault();
      pasteClipboardObject();
      getOnObjectsChanged()?.();
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "d" && getSelectedObjectId()) {
    event.preventDefault();
    duplicateSelectedObject();
    getOnObjectsChanged()?.();
    return;
  }

  const sid = getSelectedObjectId();
  if (sid && state.stratsToolSettings.activeTool === "select") {
    if (key === "[" ) {
      event.preventDefault();
      reorderSelectedObject(-1);
      return;
    }
    if (key === "]") {
      event.preventDefault();
      reorderSelectedObject(1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      nudgeSelectedObject(-NUDGE_STEP, 0);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      nudgeSelectedObject(NUDGE_STEP, 0);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      nudgeSelectedObject(0, -NUDGE_STEP);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      nudgeSelectedObject(0, NUDGE_STEP);
      return;
    }
  }

  if ((event.ctrlKey || event.metaKey) && key === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      redoStratEdit();
    } else {
      undoStratEdit();
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "y") {
    event.preventDefault();
    redoStratEdit();
    return;
  }

  if ((key === "delete" || key === "backspace") && getSelectedObjectId()) {
    event.preventDefault();
    removeObject(getSelectedObjectId());
  }
}

export {
  isTypingTarget,
  handleKeyDown,
};
