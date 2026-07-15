import { cloneStratObject } from "./strat-object-schema.js";
import {
  PASTE_OFFSET,
  getSelectedObjectId,
  setSelectedObjectId,
  getClipboardObject,
  setClipboardObject,
  getPasteIteration,
  setPasteIteration,
  getOnSelectionChange,
  getOnClipboardChange,
} from "./strat-drawing-state.js";
import {
  getActiveSlideObjects,
  getSelectedObject,
  pushUndoSnapshot,
  commitObjectsChange,
  refreshDrawLayer,
  removeObject,
} from "./strat-drawing.js";
import { isStratsEditingBlocked } from "./strat-drawing-pointer.js";

function offsetObjectPoints(points, multiplier) {
  const offset = PASTE_OFFSET * multiplier;
  return points.map((point) => ({
    x: Math.min(100, Math.max(0, point.x + offset)),
    y: Math.min(100, Math.max(0, point.y + offset)),
  }));
}

function createObjectCopy(source, offsetMultiplier = 1) {
  const copy = cloneStratObject(source);
  copy.id = `obj-${crypto.randomUUID()}`;
  copy.points = offsetObjectPoints(copy.points, offsetMultiplier);
  return copy;
}

function insertObjectCopy(copy) {
  const objects = getActiveSlideObjects();
  if (!objects || isStratsEditingBlocked()) return false;

  pushUndoSnapshot();
  objects.push(copy);
  setSelectedObject(copy.id);
  commitObjectsChange({ snapshot: false });
  notifySelectionChange();
  return true;
}

function copySelectedObject() {
  const object = getSelectedObject();
  if (!object) return false;
  setClipboardObject(cloneStratObject(object));
  setPasteIteration(0);
  notifyClipboardChange();
  return true;
}

function pasteClipboardObject() {
  const clip = getClipboardObject();
  if (!clip || isStratsEditingBlocked()) return false;
  const iter = getPasteIteration() + 1;
  setPasteIteration(iter);
  return insertObjectCopy(createObjectCopy(clip, iter));
}

function cutSelectedObject() {
  const id = getSelectedObjectId();
  if (!id || isStratsEditingBlocked()) return false;
  if (!copySelectedObject()) return false;
  removeObject(id);
  return true;
}

export function notifySelectionChange() {
  getOnSelectionChange()?.(getSelectedObject());
}

export function notifyClipboardChange() {
  getOnClipboardChange()?.();
}

export function setSelectedObject(objectId, { notify = true } = {}) {
  setSelectedObjectId(objectId);
  refreshDrawLayer();
  if (notify) {
    notifySelectionChange();
  }
}

export {
  copySelectedObject,
  pasteClipboardObject,
  cutSelectedObject,
  insertObjectCopy,
  createObjectCopy,
  offsetObjectPoints,
};
