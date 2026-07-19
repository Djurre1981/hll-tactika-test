import { getObjectBounds } from "./object-schema.js";
import { buildCanvasFont, resolveFontCss } from "./text-style.js";

const MAX_LEN = 200;

/**
 * DOM textarea over a text object — caret focused for inline edit (no window.prompt).
 */
export class TextInlineEditor {
  constructor({
    viewport,
    getViewer,
    getMapSize,
    onCommit,
    onCancel,
    onEditingChange,
  }) {
    this.viewport = viewport;
    this.getViewer = getViewer;
    this.getMapSize = getMapSize;
    this.onCommit = onCommit;
    this.onCancel = onCancel;
    this.onEditingChange = onEditingChange;

    this.objectId = null;
    this.originalText = "";
    this._object = null;
    this._closing = false;

    this.el = document.createElement("textarea");
    this.el.setAttribute("rows", "1");
    this.el.setAttribute("maxlength", String(MAX_LEN));
    this.el.setAttribute("spellcheck", "false");
    this.el.setAttribute("aria-label", "Edit text");
    Object.assign(this.el.style, {
      position: "absolute",
      zIndex: "20",
      display: "none",
      margin: "0",
      padding: "0",
      border: "1px solid rgba(255,255,255,0.45)",
      borderRadius: "4px",
      outline: "none",
      resize: "none",
      overflow: "hidden",
      background: "rgba(0,0,0,0.35)",
      color: "#fff",
      caretColor: "#fff",
      boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
      lineHeight: "1.2",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      pointerEvents: "auto",
    });

    this._onBlur = () => this.commit();
    this._onKeyDown = (e) => this.onKeyDown(e);
    this._onPointerDown = (e) => e.stopPropagation();

    this.el.addEventListener("blur", this._onBlur);
    this.el.addEventListener("keydown", this._onKeyDown);
    this.el.addEventListener("pointerdown", this._onPointerDown);
    viewport.appendChild(this.el);
  }

  get active() {
    return Boolean(this.objectId);
  }

  start(object, { selectAll = false } = {}) {
    if (!object || object.type !== "text") return;
    if (this.objectId && this.objectId !== object.id) {
      this.commit({ skipFocusRestore: true });
    }

    this._closing = false;
    this.objectId = object.id;
    this._object = object;
    this.originalText = String(object.meta?.text || "");
    this.el.value = this.originalText;
    this.syncLayout(object);
    this.el.style.display = "block";
    this.onEditingChange?.(object.id);

    requestAnimationFrame(() => {
      if (this.objectId !== object.id) return;
      this.el.focus({ preventScroll: true });
      const len = this.el.value.length;
      if (selectAll && len > 0) this.el.setSelectionRange(0, len);
      else this.el.setSelectionRange(len, len);
    });
  }

  syncLayout(object = this._object) {
    if (!this.objectId || !object) return;
    const viewer = this.getViewer?.();
    const bounds = getObjectBounds(object);
    if (!viewer || !bounds) return;

    const tl = viewer.mapPercentToScreen(bounds.x, bounds.y);
    const br = viewer.mapPercentToScreen(bounds.x + bounds.w, bounds.y + bounds.h);
    const w = Math.max(24, br.x - tl.x);
    const h = Math.max(18, br.y - tl.y);
    const mapSize = this.getMapSize?.() || 1920;
    const scale = Math.max(0.08, viewer.scale || 1);
    const fontPx = Math.max(
      8,
      (Number(object.style?.fontSize) || 14) * 0.22 * (mapSize / 100) * scale
    );
    const pad = Math.max(0, (Number(object.style?.padding) || 0) * 0.22 * (mapSize / 100) * scale);
    const rot = Number(object.style?.rotation) || 0;

    this.el.style.left = `${tl.x}px`;
    this.el.style.top = `${tl.y}px`;
    this.el.style.width = `${w}px`;
    this.el.style.height = `${h}px`;
    this.el.style.padding = `${pad}px`;
    this.el.style.font = buildCanvasFont(object.style || {}, fontPx);
    this.el.style.fontFamily = resolveFontCss(object.style?.fontFamily);
    this.el.style.color = object.style?.color || "#ffffff";
    this.el.style.textAlign = object.style?.textAlign || "center";
    this.el.style.transformOrigin = "center center";
    this.el.style.transform = rot ? `rotate(${rot}deg)` : "";
  }

  onKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      this.commit();
    }
    event.stopPropagation();
  }

  commit({ skipFocusRestore = false } = {}) {
    if (!this.objectId || this._closing) return;
    this._closing = true;
    const id = this.objectId;
    let text = String(this.el.value || "").slice(0, MAX_LEN);
    if (!text.trim()) text = "Text";
    this.hide();
    this.onCommit?.(id, text);
    this._closing = false;
    if (!skipFocusRestore) this.viewport?.focus?.();
  }

  cancel() {
    if (!this.objectId || this._closing) return;
    this._closing = true;
    const id = this.objectId;
    const original = this.originalText;
    this.hide();
    this.onCancel?.(id, original);
    this._closing = false;
    this.viewport?.focus?.();
  }

  hide() {
    this.objectId = null;
    this._object = null;
    this.el.style.display = "none";
    this.el.value = "";
    this.onEditingChange?.(null);
  }

  destroy() {
    this.el.removeEventListener("blur", this._onBlur);
    this.el.removeEventListener("keydown", this._onKeyDown);
    this.el.removeEventListener("pointerdown", this._onPointerDown);
    this.el.remove();
    this.objectId = null;
  }
}