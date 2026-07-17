/**
 * Grid + strongpoint image layers inside the map stage (vanilla, no React).
 */
export class MapOverlays {
  constructor(stage, image) {
    this.stage = stage;
    this.image = image;
    this.mapId = null;
    this.toggles = { grid: true, strongpoints: true };

    this.gridLayer = this.createLayer();
    this.strongpointsLayer = this.createLayer();

    this.gridImage = document.createElement("img");
    this.gridImage.src = "/maps/plain-grid.png";
    this.gridImage.alt = "";
    this.gridImage.draggable = false;
    Object.assign(this.gridImage.style, {
      display: "block",
      width: "1920px",
      height: "1920px",
      pointerEvents: "none",
      userSelect: "none",
    });
    this.gridLayer.appendChild(this.gridImage);

    this.spImage = document.createElement("img");
    this.spImage.alt = "";
    this.spImage.draggable = false;
    Object.assign(this.spImage.style, {
      display: "block",
      width: "1920px",
      height: "1920px",
      pointerEvents: "none",
      userSelect: "none",
    });
    this.strongpointsLayer.appendChild(this.spImage);

    this.image.addEventListener("load", () => this.syncSize());
    this.syncSize();
    this.render();
  }

  createLayer() {
    const layer = document.createElement("div");
    Object.assign(layer.style, {
      position: "absolute",
      left: "0",
      top: "0",
      pointerEvents: "none",
    });
    // Insert above map image, below drawing canvas
    const canvas = this.stage.querySelector("canvas");
    if (canvas) this.stage.insertBefore(layer, canvas);
    else this.stage.appendChild(layer);
    return layer;
  }

  syncSize() {
    const w = this.image.naturalWidth || 1920;
    const h = this.image.naturalHeight || 1920;
    for (const img of [this.gridImage, this.spImage]) {
      img.style.width = `${w}px`;
      img.style.height = `${h}px`;
    }
  }

  setMapId(mapId) {
    if (!mapId || mapId === this.mapId) return;
    this.mapId = mapId;
    this.spImage.src = `/maps/points/${mapId}_SP_NoMap2.png`;
    this.render();
  }

  setToggle(key, enabled) {
    this.toggles[key] = Boolean(enabled);
    this.render();
  }

  setToggles(partial = {}) {
    Object.assign(this.toggles, partial);
    this.render();
  }

  render() {
    this.gridLayer.style.display = this.toggles.grid ? "block" : "none";
    this.strongpointsLayer.style.display = this.toggles.strongpoints ? "block" : "none";
  }

  destroy() {
    this.gridLayer.remove();
    this.strongpointsLayer.remove();
  }
}
