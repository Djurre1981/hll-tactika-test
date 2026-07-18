import { normalizeStratObjects } from "./object-schema.js";

const MAX_UNDO = 40;

/** Retained object list + undo/redo (pre-Yjs). */
export class SceneGraph {
  constructor() {
    this.objects = [];
    this.undoStack = [];
    this.redoStack = [];
    this.selectedId = null;
    this.onChange = null;
    this.onSelectionChange = null;
  }

  load(objects) {
    this.objects = normalizeStratObjects(objects);
    this.undoStack = [];
    this.redoStack = [];
    this.selectedId = null;
    this.emitSelection();
    this.emitChange({ reason: "load" });
  }

  getObjects() {
    return this.objects;
  }

  getSelected() {
    if (!this.selectedId) return null;
    return this.objects.find((o) => o.id === this.selectedId) || null;
  }

  setSelectedId(id, { notify = true } = {}) {
    this.selectedId = id || null;
    if (notify) this.emitSelection();
  }

  pushUndo() {
    this.undoStack.push(structuredClone(this.objects));
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (!this.undoStack.length) return false;
    this.redoStack.push(structuredClone(this.objects));
    this.objects = this.undoStack.pop();
    if (this.selectedId && !this.objects.some((o) => o.id === this.selectedId)) {
      this.selectedId = null;
      this.emitSelection();
    }
    this.emitChange({ reason: "undo" });
    return true;
  }

  redo() {
    if (!this.redoStack.length) return false;
    this.undoStack.push(structuredClone(this.objects));
    this.objects = this.redoStack.pop();
    this.emitChange({ reason: "redo" });
    return true;
  }

  addObject(object, { pushUndo = true } = {}) {
    if (pushUndo) this.pushUndo();
    this.objects = [...this.objects, { ...object, zIndex: this.objects.length }];
    this.emitChange({ reason: "add" });
  }

  removeObject(id, { pushUndo = true } = {}) {
    const index = this.objects.findIndex((o) => o.id === id);
    if (index < 0) return false;
    if (pushUndo) this.pushUndo();
    this.objects = this.objects.filter((o) => o.id !== id);
    if (this.selectedId === id) {
      this.selectedId = null;
      this.emitSelection();
    }
    this.emitChange({ reason: "remove" });
    return true;
  }

  updateObject(id, updater, { pushUndo = false } = {}) {
    const index = this.objects.findIndex((o) => o.id === id);
    if (index < 0) return false;
    if (pushUndo) this.pushUndo();
    const next = structuredClone(this.objects);
    next[index] = updater(next[index]) || next[index];
    this.objects = next;
    this.emitChange({ reason: "update" });
    return true;
  }

  replaceObjects(objects, { pushUndo = true } = {}) {
    if (pushUndo) this.pushUndo();
    this.objects = normalizeStratObjects(objects);
    this.emitChange({ reason: "replace" });
  }

  findTopAt(point, hitTest) {
    for (let i = this.objects.length - 1; i >= 0; i -= 1) {
      if (hitTest(this.objects[i], point)) return this.objects[i];
    }
    return null;
  }

  emitChange(meta = {}) {
    this.onChange?.(this.objects, meta);
  }

  emitSelection() {
    this.onSelectionChange?.(this.getSelected());
  }
}
