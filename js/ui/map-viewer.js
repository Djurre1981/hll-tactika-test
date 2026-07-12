const MAX_SCALE = 5;
const ZOOM_STEP = 1.15;
const SIDEBAR_PANEL_TRANSITION_MS = 400;

import { state } from "../state.js";
import { isPortraitLayout } from "./chrome-panels.js";

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
    this._layoutFollowFrame = null;
    this._layoutFollowStop = null;

    this.bindEvents();
  }

  stopLayoutFollow() {
    if (this._layoutFollowFrame) {
      cancelAnimationFrame(this._layoutFollowFrame);
      this._layoutFollowFrame = null;
    }
    if (this._layoutFollowStop) {
      this._layoutFollowStop();
      this._layoutFollowStop = null;
    }
  }

  /** Pan the map in sync with the sidebar panel transition. */
  followSidebarLayout() {
    if (isPortraitLayout()) return;

    this.stopLayoutFollow();

    const imgW = this.image.naturalWidth || this.image.width;
    const imgH = this.image.naturalHeight || this.image.height;
    if (!imgW || !imgH) return;

    const startedAt = performance.now();
    let running = true;
    this._layoutFollowStop = () => {
      running = false;
    };

    const tick = (now) => {
      if (!running) return;

      const bounds = this.getVisibleBounds({ trackPanelMotion: true });
      const contentW = imgW * this.scale;
      const contentH = imgH * this.scale;
      const centerX = this.getFocusCenterX();
      this.translateX = centerX - contentW / 2;
      this.translateY = bounds.centerY - contentH / 2;
      this.clampTranslation();
      this.applyTransform();

      if (now - startedAt < SIDEBAR_PANEL_TRANSITION_MS) {
        this._layoutFollowFrame = requestAnimationFrame(tick);
        return;
      }

      this._layoutFollowFrame = null;
      this._layoutFollowStop = null;
      this.alignToVisibleBounds();
    };

    this._layoutFollowFrame = requestAnimationFrame(tick);
  }

  alignToVisibleBounds() {
    const imgW = this.image.naturalWidth || this.image.width;
    const imgH = this.image.naturalHeight || this.image.height;
    if (!imgW || !imgH) return;

    const bounds = this.getVisibleBounds();
    const centerX = this.getFocusCenterX();
    this.translateX = centerX - (imgW * this.scale) / 2;
    this.translateY = bounds.centerY - (imgH * this.scale) / 2;
    this.clampTranslation();
    this.applyTransform();
  }

  getSettledSidebarOffset(viewportLeft = 0) {
    const sidebarShell = document.getElementById("sidebar-shell");
    if (!sidebarShell || isPortraitLayout()) return 0;
    if (sidebarShell.classList.contains("is-collapsed")) return 0;

    const rootStyles = getComputedStyle(document.documentElement);
    const shellStyles = getComputedStyle(sidebarShell);
    const gap = parseFloat(rootStyles.getPropertyValue("--sidebar-gap")) || 0;
    const toggleW = parseFloat(shellStyles.getPropertyValue("--toggle-w")) || 0;
    const shellGap = parseFloat(shellStyles.getPropertyValue("--shell-gap")) || 0;
    const sidebar = sidebarShell.querySelector(".sidebar");
    const sidebarW = sidebar?.offsetWidth || 0;
    if (!sidebarW) {
      const sidebarRect = sidebarShell.getBoundingClientRect();
      return Math.max(0, sidebarRect.right - viewportLeft);
    }

    return Math.max(0, gap + sidebarW + shellGap + toggleW - viewportLeft);
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

  getVisibleBounds({ trackPanelMotion = false } = {}) {
    const rect = this.viewport.getBoundingClientRect();
    const sidebarShell = document.getElementById("sidebar-shell");
    let visibleLeft = 0;
    let visibleTop = 0;
    let visibleWidth = rect.width;
    let visibleHeight = rect.height;

    if (sidebarShell && !isPortraitLayout() && !sidebarShell.classList.contains("is-collapsed")) {
      if (trackPanelMotion) {
        const sidebarRect = sidebarShell.getBoundingClientRect();
        if (sidebarRect.right > rect.left && sidebarRect.left < rect.right) {
          visibleLeft = Math.max(0, sidebarRect.right - rect.left);
          visibleWidth = Math.max(0, rect.width - visibleLeft);
        }
      } else {
        visibleLeft = this.getSettledSidebarOffset(rect.left);
        visibleWidth = Math.max(0, rect.width - visibleLeft);
      }
    }

    return {
      left: visibleLeft,
      top: visibleTop,
      width: visibleWidth,
      height: visibleHeight,
      centerX: visibleLeft + visibleWidth / 2,
      centerY: visibleTop + visibleHeight / 2,
    };
  }

  getVisibleCenterX() {
    return this.getVisibleBounds().centerX;
  }

  /** Horizontal focal point aligned with the Viewer/Editor mode switch. */
  getFocusCenterX() {
    const rect = this.viewport.getBoundingClientRect();
    const modeSwitch = document.getElementById("mode-switch");
    if (modeSwitch && !modeSwitch.classList.contains("hidden")) {
      const switchRect = modeSwitch.getBoundingClientRect();
      if (switchRect.width > 0) {
        return switchRect.left + switchRect.width / 2 - rect.left;
      }
    }
    return this.getVisibleCenterX();
  }

  focusAtMapPercent(xPercent, yPercent, { zoomPercent = 75 } = {}) {
    const rect = this.viewport.getBoundingClientRect();
    const imgW = this.image.naturalWidth || this.image.width;
    const imgH = this.image.naturalHeight || this.image.height;
    if (!imgW || !imgH) return;

    this.scale = this.clampScale(zoomPercent / 100);

    const focalX = this.getFocusCenterX();
    const focalY = rect.height / 2;
    const contentW = imgW * this.scale;
    const contentH = imgH * this.scale;

    this.translateX = focalX - (xPercent / 100) * contentW;
    this.translateY = focalY - (yPercent / 100) * contentH;
    this.clampTranslation();
    this.applyTransform();
  }

  fitToView() {
    const rect = this.viewport.getBoundingClientRect();
    const imgW = this.image.naturalWidth || this.image.width;
    const imgH = this.image.naturalHeight || this.image.height;

    if (!imgW || !imgH) return;

    const bounds = this.getVisibleBounds();
    const centerX = this.getFocusCenterX();
    this.scale = this.getFitScale();
    this.translateX = centerX - (imgW * this.scale) / 2;
    this.translateY = bounds.centerY - (imgH * this.scale) / 2;
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
    this.zoomBy(ZOOM_STEP, this.getFocusCenterX(), rect.height / 2);
  }

  zoomOut() {
    const rect = this.viewport.getBoundingClientRect();
    this.zoomBy(1 / ZOOM_STEP, this.getFocusCenterX(), rect.height / 2);
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
    if (this.shouldAllowPan && !this.shouldAllowPan(event)) return;
    this.stopLayoutFollow();
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

  isPhoneLayout() {
    return window.matchMedia("(max-width: 768px), (hover: none) and (pointer: coarse)").matches;
  }

  isLandscapeViewport() {
    const rect = this.viewport.getBoundingClientRect();
    return rect.width >= rect.height;
  }

  getFitScale() {
    const rect = this.viewport.getBoundingClientRect();
    const imgW = this.image.naturalWidth || this.image.width;
    const imgH = this.image.naturalHeight || this.image.height;

    if (!imgW || !imgH || !rect.width || !rect.height) return 0.1;

    if (this.isPhoneLayout()) {
      return rect.width / imgW;
    }
    return rect.height / imgH;
  }

  getMinScale() {
    return this.getFitScale();
  }

  clampScale(value) {
    return Math.min(MAX_SCALE, Math.max(this.getMinScale(), value));
  }

  /** Limit pan so at most half the viewport shows empty background on that axis. */
  clampAxisWithHalfOverscroll(value, contentSize, viewportSize) {
    const half = viewportSize / 2;
    return Math.min(half, Math.max(half - contentSize, value));
  }

  /** Lock pan to map edges; center when the map is smaller than the viewport. */
  clampAxisToMapEdges(value, contentSize, viewportSize) {
    if (contentSize <= viewportSize) {
      return (viewportSize - contentSize) / 2;
    }
    return Math.min(0, Math.max(viewportSize - contentSize, value));
  }

  clampTranslation() {
    const rect = this.viewport.getBoundingClientRect();
    const imgW = this.image.naturalWidth || this.image.width;
    const imgH = this.image.naturalHeight || this.image.height;
    const contentW = imgW * this.scale;
    const contentH = imgH * this.scale;

    this.translateX = this.clampAxisWithHalfOverscroll(this.translateX, contentW, rect.width);

    if (this.isLandscapeViewport()) {
      this.translateY = this.clampAxisToMapEdges(this.translateY, contentH, rect.height);
    } else {
      this.translateY = this.clampAxisWithHalfOverscroll(this.translateY, contentH, rect.height);
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
