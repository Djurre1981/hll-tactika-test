const MAX_SCALE = 5;
const ZOOM_STEP = 1.15;
const MIN_SCALE = 0.2;

/**
 * Pan/zoom map stage. Coords: map-% via screenToMapPercent / mapPercentToScreen.
 * Overlay canvas lives as sibling of the map image inside stage.
 */
export class MapViewer {
  constructor(viewport, stage, image) {
    this.viewport = viewport;
    this.stage = stage;
    this.image = image;

    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.isDragging = false;
    this.activePointers = new Map();
    this.pinchStartDistance = 0;
    this.pinchStartScale = 1;
    this.dragStart = { x: 0, y: 0 };
    this.translateStart = { x: 0, y: 0 };
    this.onTransform = null;
    this.blockPan = false;
    this.panelInsets = { left: 0, right: 0, top: 0, bottom: 0 };

    this._onWheel = (e) => this.onWheel(e);
    this._onPointerDown = (e) => this.onPointerDown(e);
    this._onPointerMove = (e) => this.onPointerMove(e);
    this._onPointerUp = (e) => this.onPointerUp(e);
    this._onResize = () => {
      this.scale = this.clampScale(this.scale);
      this.clampTranslation();
      this.applyTransform();
    };

    this.bindEvents();
  }

  bindEvents() {
    this.viewport.addEventListener("wheel", this._onWheel, { passive: false });
    this.viewport.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("pointercancel", this._onPointerUp);
    window.addEventListener("resize", this._onResize);
  }

  destroy() {
    this.viewport.removeEventListener("wheel", this._onWheel);
    this.viewport.removeEventListener("pointerdown", this._onPointerDown);
    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);
    window.removeEventListener("pointercancel", this._onPointerUp);
    window.removeEventListener("resize", this._onResize);
  }

  setBlockPan(block) {
    this.blockPan = Boolean(block);
  }

  setPanelInsets({ left = 0, right = 0, top = 0, bottom = 0 } = {}) {
    this.panelInsets = {
      left: Math.max(0, left),
      right: Math.max(0, right),
      top: Math.max(0, top),
      bottom: Math.max(0, bottom),
    };
  }

  getVisibleBounds() {
    const rect = this.viewport.getBoundingClientRect();
    const { left, right, top, bottom } = this.panelInsets;
    const width = Math.max(1, rect.width - left - right);
    const height = Math.max(1, rect.height - top - bottom);
    return {
      left,
      top,
      width,
      height,
      centerX: left + width / 2,
      centerY: top + height / 2,
    };
  }

  getCamera() {
    return { x: this.translateX, y: this.translateY, zoom: this.scale };
  }

  setCamera({ x, y, zoom } = {}) {
    if (Number.isFinite(zoom)) this.scale = this.clampScale(zoom);
    if (Number.isFinite(x)) this.translateX = x;
    if (Number.isFinite(y)) this.translateY = y;
    this.clampTranslation();
    this.applyTransform();
  }

  fitToView() {
    const imgW = this.image.naturalWidth || this.image.width || 1920;
    const imgH = this.image.naturalHeight || this.image.height || 1920;
    const bounds = this.getVisibleBounds();
    if (!bounds.width || !bounds.height) return;

    const scale =
      Math.min(bounds.width / imgW, bounds.height / imgH) * 0.95;
    this.scale = this.clampScale(scale);
    this.translateX = bounds.centerX - (imgW * this.scale) / 2;
    this.translateY = bounds.centerY - (imgH * this.scale) / 2;
    this.clampTranslation();
    this.applyTransform();
  }

  clampScale(scale) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
  }

  clampTranslation() {
    const bounds = this.getVisibleBounds();
    const imgW = this.image.naturalWidth || this.image.width || 1920;
    const imgH = this.image.naturalHeight || this.image.height || 1920;
    const contentW = imgW * this.scale;
    const contentH = imgH * this.scale;

    const clampAxis = (value, content, viewSize, origin) => {
      if (content <= viewSize) return origin + (viewSize - content) / 2;
      const min = origin + viewSize - content;
      const max = origin;
      return Math.min(max, Math.max(min, value));
    };

    this.translateX = clampAxis(
      this.translateX,
      contentW,
      bounds.width,
      bounds.left
    );
    this.translateY = clampAxis(
      this.translateY,
      contentH,
      bounds.height,
      bounds.top
    );
  }

  applyTransform() {
    this.stage.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
    this.onTransform?.(this.getCamera());
  }

  screenToMapPercent(clientX, clientY) {
    const rect = this.viewport.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const mapX = (x - this.translateX) / this.scale;
    const mapY = (y - this.translateY) / this.scale;
    const imgW = this.image.naturalWidth || this.image.width || 1920;
    const imgH = this.image.naturalHeight || this.image.height || 1920;
    return { x: (mapX / imgW) * 100, y: (mapY / imgH) * 100 };
  }

  mapPercentToScreen(xPercent, yPercent) {
    const imgW = this.image.naturalWidth || this.image.width || 1920;
    const imgH = this.image.naturalHeight || this.image.height || 1920;
    return {
      x: this.translateX + (xPercent / 100) * imgW * this.scale,
      y: this.translateY + (yPercent / 100) * imgH * this.scale,
    };
  }

  getMapAspect() {
    const imgW = this.image.naturalWidth || this.image.width || 1920;
    const imgH = this.image.naturalHeight || this.image.height || 1920;
    return imgW / imgH;
  }

  onWheel(event) {
    event.preventDefault();
    const rect = this.viewport.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const before = this.scale;
    const next = this.clampScale(
      event.deltaY < 0 ? before * ZOOM_STEP : before / ZOOM_STEP
    );
    if (next === before) return;

    const worldX = (mx - this.translateX) / before;
    const worldY = (my - this.translateY) / before;
    this.scale = next;
    this.translateX = mx - worldX * next;
    this.translateY = my - worldY * next;
    this.clampTranslation();
    this.applyTransform();
  }

  onPointerDown(event) {
    if (event.button !== 0) return;
    if (this.blockPan) return;

    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.activePointers.size === 1) {
      this.isDragging = true;
      this.dragStart = { x: event.clientX, y: event.clientY };
      this.translateStart = { x: this.translateX, y: this.translateY };
      this.viewport.setPointerCapture?.(event.pointerId);
    } else if (this.activePointers.size === 2) {
      this.isDragging = false;
      const pts = [...this.activePointers.values()];
      this.pinchStartDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.pinchStartScale = this.scale;
    }
  }

  onPointerMove(event) {
    if (!this.activePointers.has(event.pointerId)) return;
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 2) {
      const pts = [...this.activePointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.pinchStartDistance > 0) {
        this.scale = this.clampScale(
          this.pinchStartScale * (dist / this.pinchStartDistance)
        );
        this.clampTranslation();
        this.applyTransform();
      }
      return;
    }

    if (!this.isDragging || this.blockPan) return;
    this.translateX = this.translateStart.x + (event.clientX - this.dragStart.x);
    this.translateY = this.translateStart.y + (event.clientY - this.dragStart.y);
    this.clampTranslation();
    this.applyTransform();
  }

  onPointerUp(event) {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size === 0) {
      this.isDragging = false;
    } else if (this.activePointers.size === 1) {
      const remaining = [...this.activePointers.values()][0];
      this.isDragging = !this.blockPan;
      this.dragStart = { x: remaining.x, y: remaining.y };
      this.translateStart = { x: this.translateX, y: this.translateY };
    }
  }
}
