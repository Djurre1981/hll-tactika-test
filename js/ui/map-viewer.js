const MAX_SCALE = 5;
const ZOOM_STEP = 1.15;

import { state } from "../state.js";

export class MapViewer {
  constructor(viewport, stage, image) {
    this.viewport = viewport;
    this.stage = stage;
    this.image = image;

    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.translateStart = { x: 0, y: 0 };
    this.onTransform = null;

    this.bindEvents();
  }

  /** Re-fit after chrome animations / late layout so centering matches sidebar. */
  scheduleLayoutFit() {
    const fit = () => this.fitToView();
    requestAnimationFrame(() => requestAnimationFrame(fit));
    const sidebar = document.getElementById("sidebar");
    sidebar?.addEventListener("animationend", fit, { once: true });
  }

  bindEvents() {
    this.viewport.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
    this.viewport.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    window.addEventListener("pointerup", (e) => this.onPointerUp(e));
    window.addEventListener("resize", () => {
      this.scale = this.clampScale(this.scale);
      this.clampTranslation();
    });
  }

  setEditMode(enabled) {
    this.viewport.classList.toggle("is-edit-mode", enabled);
  }

  setEditorMode(enabled) {
    this.viewport.classList.toggle("is-editor-mode", enabled);
  }

  getVisibleBounds() {
    const rect = this.viewport.getBoundingClientRect();
    const sidebar = document.getElementById("sidebar");
    let visibleLeft = 0;

    if (sidebar) {
      const sidebarRect = sidebar.getBoundingClientRect();
      if (sidebarRect.right > rect.left && sidebarRect.left < rect.right) {
        visibleLeft = Math.max(0, sidebarRect.right - rect.left);
      }
    }

    const visibleWidth = rect.width - visibleLeft;

    return {
      left: visibleLeft,
      width: visibleWidth,
      height: rect.height,
      centerX: visibleLeft + visibleWidth / 2,
    };
  }

  getVisibleCenterX() {
    return this.getVisibleBounds().centerX;
  }

  fitToView() {
    const rect = this.viewport.getBoundingClientRect();
    const imgW = this.image.naturalWidth || this.image.width;
    const imgH = this.image.naturalHeight || this.image.height;

    if (!imgW || !imgH) return;

    this.scale = Math.min(this.getMinScale(), 1);
    this.translateX = this.getVisibleCenterX() - (imgW * this.scale) / 2;
    this.translateY = (rect.height - imgH * this.scale) / 2;
    this.clampTranslation();
    this.applyTransform();
  }

  resetView() {
    this.fitToView();
  }

  zoomBy(factor, focalX, focalY) {
    const rect = this.viewport.getBoundingClientRect();
    const px = focalX ?? rect.width / 2;
    const py = focalY ?? rect.height / 2;

    const nextScale = this.clampScale(this.scale * factor);
    const ratio = nextScale / this.scale;

    this.translateX = px - ratio * (px - this.translateX);
    this.translateY = py - ratio * (py - this.translateY);
    this.scale = nextScale;

    this.clampTranslation();
    this.applyTransform();
  }

  zoomIn() {
    const rect = this.viewport.getBoundingClientRect();
    this.zoomBy(ZOOM_STEP, this.getVisibleCenterX(), rect.height / 2);
  }

  zoomOut() {
    const rect = this.viewport.getBoundingClientRect();
    this.zoomBy(1 / ZOOM_STEP, this.getVisibleCenterX(), rect.height / 2);
  }

  onWheel(event) {
    event.preventDefault();
    const rect = this.viewport.getBoundingClientRect();
    const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    this.zoomBy(factor, event.clientX - rect.left, event.clientY - rect.top);
  }

  onPointerDown(event) {
    if (event.button !== 0) return;
    if (state.pinDragSession) return;
    if (event.target.closest(".map-pin, .map-mg-spot, .map-pin--draft.is-draggable, .map-mg-spot--draft.is-placement-complete, .mg-spot-head, .mg-spot-base")) return;

    this.isDragging = true;
    this.viewport.setPointerCapture(event.pointerId);
    this.viewport.classList.add("is-dragging");
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.translateStart = { x: this.translateX, y: this.translateY };
  }

  onPointerMove(event) {
    if (!this.isDragging) return;

    this.translateX = this.translateStart.x + (event.clientX - this.dragStart.x);
    this.translateY = this.translateStart.y + (event.clientY - this.dragStart.y);
    this.clampTranslation();
    this.applyTransform();
  }

  onPointerUp(event) {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.viewport.classList.remove("is-dragging");
    try {
      this.viewport.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer may already be released */
    }
  }

  getMinScale() {
    const bounds = this.getVisibleBounds();
    const imgW = this.image.naturalWidth || this.image.width;
    const imgH = this.image.naturalHeight || this.image.height;

    if (!imgW || !imgH || !bounds.width || !bounds.height) return 0.1;

    return Math.min(bounds.width / imgW, bounds.height / imgH);
  }

  clampScale(value) {
    return Math.min(MAX_SCALE, Math.max(this.getMinScale(), value));
  }

  clampTranslation() {
    const rect = this.viewport.getBoundingClientRect();
    const imgW = this.image.naturalWidth || this.image.width;
    const imgH = this.image.naturalHeight || this.image.height;
    const contentW = imgW * this.scale;
    const contentH = imgH * this.scale;

    if (contentW <= rect.width) {
      this.translateX = this.getVisibleCenterX() - contentW / 2;
    } else {
      const minX = rect.width - contentW;
      this.translateX = Math.min(0, Math.max(minX, this.translateX));
    }

    if (contentH <= rect.height) {
      this.translateY = (rect.height - contentH) / 2;
    } else {
      const minY = rect.height - contentH;
      this.translateY = Math.min(0, Math.max(minY, this.translateY));
    }
  }

  applyTransform() {
    this.stage.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
    if (this.onTransform) {
      this.onTransform({
        scale: this.scale,
        translateX: this.translateX,
        translateY: this.translateY,
      });
    }
  }

  /** Convert viewport click position to map percentage coordinates */
  screenToMapPercent(clientX, clientY) {
    const rect = this.viewport.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const mapX = (x - this.translateX) / this.scale;
    const mapY = (y - this.translateY) / this.scale;

    const imgW = this.image.naturalWidth || this.image.width;
    const imgH = this.image.naturalHeight || this.image.height;

    return {
      x: (mapX / imgW) * 100,
      y: (mapY / imgH) * 100,
    };
  }

  /** Convert map percentage to viewport pixel position */
  mapPercentToScreen(xPercent, yPercent) {
    const imgW = this.image.naturalWidth || this.image.width;
    const imgH = this.image.naturalHeight || this.image.height;

    return {
      x: this.translateX + (xPercent / 100) * imgW * this.scale,
      y: this.translateY + (yPercent / 100) * imgH * this.scale,
    };
  }

  getZoomPercent() {
    return Math.round(this.scale * 100);
  }
}
