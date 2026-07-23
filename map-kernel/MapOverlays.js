/**
 * Grid + strongpoint image layers inside the map stage (vanilla, no React).
 * Per-sector visibility follows maps-let-loose sp-grid toggles.
 */
import {
  loadImage,
  loadStrongpointNames,
  resolveLabelSrc,
  STRONGPOINT_MAP_SIZE,
} from "./strongpoint-labels.js";
import { getStrongpointGridFromSpawns, loadMapSpawnsData } from "./map-spawns-data.js";

function sectorKey(row, col) {
  return `${row}${col}`;
}

const cutoutStyle = {
  position: "absolute",
  display: "block",
  pointerEvents: "none",
  userSelect: "none",
};

const labelStyle = {
  position: "absolute",
  display: "block",
  pointerEvents: "none",
  userSelect: "none",
  zIndex: "1",
};

function compositeCutout(rects, spImage, mapSize = STRONGPOINT_MAP_SIZE) {
  if (!rects?.length || !spImage?.naturalWidth) return null;

  let top = mapSize;
  let left = mapSize;
  let right = 0;
  let bottom = 0;

  for (const rect of rects) {
    const [x, y, w, h] = rect;
    top = Math.min(top, y);
    left = Math.min(left, x);
    right = Math.max(right, x + w);
    bottom = Math.max(bottom, y + h);
  }

  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;

  const scale = spImage.naturalWidth / mapSize;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");

  for (const rect of rects) {
    const [x, y, w, h] = rect;
    ctx.drawImage(
      spImage,
      x * scale,
      y * scale,
      w * scale,
      h * scale,
      (x - left) * scale,
      (y - top) * scale,
      w * scale,
      h * scale
    );
  }

  return {
    dataUrl: canvas.toDataURL(),
    left,
    top,
    width,
    height,
  };
}

export class MapOverlays {
  constructor(stage, image) {
    this.stage = stage;
    this.image = image;
    this.mapId = null;
    this.toggles = { grid: true, strongpoints: true, strongpointNames: true, accessibility: false };
    this.strongpointNames = null;
    this.strongpointGrid = null;
    this.visibleStrongpoints = null;
    this.cutouts = {};
    this.labelBuildId = 0;
    this.renderBuildId = 0;

    this.gridLayer = this.createLayer();
    this.strongpointsLayer = this.createLayer();
    this.accessibilityLayer = this.createLayer();

    this.gridImage = document.createElement("img");
    this.gridImage.src = "/maps/plain-grid.png";
    this.gridImage.alt = "";
    this.gridImage.draggable = false;
    Object.assign(this.gridImage.style, {
      display: "block",
      maxWidth: "none",
      pointerEvents: "none",
      userSelect: "none",
    });
    this.gridLayer.appendChild(this.gridImage);

    this.spCutoutsLayer = document.createElement("div");
    Object.assign(this.spCutoutsLayer.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    });
    this.strongpointsLayer.appendChild(this.spCutoutsLayer);

    this.spLabelsLayer = document.createElement("div");
    Object.assign(this.spLabelsLayer.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "1",
    });
    this.strongpointsLayer.appendChild(this.spLabelsLayer);

    this.accessibilityImage = document.createElement("img");
    this.accessibilityImage.alt = "";
    this.accessibilityImage.draggable = false;
    Object.assign(this.accessibilityImage.style, {
      display: "block",
      maxWidth: "none",
      pointerEvents: "none",
      userSelect: "none",
      opacity: "0.55",
    });
    this.accessibilityLayer.appendChild(this.accessibilityImage);

    this.image.addEventListener("load", () => this.syncSize());
    Promise.all([loadStrongpointNames(), loadMapSpawnsData()]).then(([names]) => {
      this.strongpointNames = names;
      if (this.mapId) this.scheduleStrongpointRender();
    });
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
    const canvas = this.stage.querySelector("canvas");
    if (canvas) this.stage.insertBefore(layer, canvas);
    else this.stage.appendChild(layer);
    return layer;
  }

  syncSize() {
    const w = this.image.naturalWidth || STRONGPOINT_MAP_SIZE;
    const h = this.image.naturalHeight || w;
    for (const layer of [this.gridLayer, this.strongpointsLayer, this.accessibilityLayer]) {
      layer.style.width = `${w}px`;
      layer.style.height = `${h}px`;
    }
    for (const img of [this.gridImage, this.accessibilityImage]) {
      img.style.width = `${w}px`;
      img.style.height = `${h}px`;
    }
  }

  isSectorVisible(key) {
    if (!this.visibleStrongpoints) return true;
    return this.visibleStrongpoints.has(String(key));
  }

  async setMapId(mapId) {
    if (!mapId) return;
    const changed = mapId !== this.mapId;
    this.mapId = mapId;
    this.cutouts = {};
    this.accessibilityImage.src = `/maps/accessibility/${mapId}_Accessible.png`;

    const spawns = await loadMapSpawnsData();
    this.strongpointGrid = getStrongpointGridFromSpawns(spawns, mapId);

    if (changed) {
      this.scheduleStrongpointRender();
    }
    this.render();
  }

  setVisibleStrongpoints(keys) {
    if (keys == null) {
      this.visibleStrongpoints = null;
    } else {
      this.visibleStrongpoints = new Set((keys || []).map(String));
    }
    this.scheduleStrongpointRender();
  }

  setToggle(key, enabled) {
    this.setToggles({ [key]: Boolean(enabled) });
  }

  setToggles(partial = {}) {
    const spWasOn = this.toggles.strongpoints;
    const namesChanged =
      "strongpointNames" in partial &&
      partial.strongpointNames !== this.toggles.strongpointNames;
    Object.assign(this.toggles, partial);
    this.render();
    if ((partial.strongpoints && !spWasOn) || namesChanged) {
      this.scheduleStrongpointRender();
    }
  }

  render() {
    this.gridLayer.style.display = this.toggles.grid ? "block" : "none";
    this.strongpointsLayer.style.display = this.toggles.strongpoints ? "block" : "none";
    this.accessibilityLayer.style.display = this.toggles.accessibility ? "block" : "none";
    if (!this.toggles.strongpoints) {
      this.spCutoutsLayer.innerHTML = "";
      this.spLabelsLayer.innerHTML = "";
    }
  }

  scheduleStrongpointRender() {
    this.renderBuildId += 1;
    const buildId = this.renderBuildId;
    this.renderStrongpoints(buildId);
  }

  buildCutouts(spImage) {
    const grid = this.strongpointGrid;
    const cutouts = {};
    if (!grid || !spImage?.naturalWidth) return cutouts;

    for (let row = 0; row < grid.length; row++) {
      const rowData = grid[row];
      if (!rowData) continue;
      for (let col = 0; col < rowData.length; col++) {
        const rects = rowData[col];
        if (!rects) continue;
        const cutout = compositeCutout(rects, spImage);
        if (cutout) cutouts[sectorKey(row, col)] = cutout;
      }
    }
    return cutouts;
  }

  renderCutouts() {
    this.spCutoutsLayer.innerHTML = "";
    for (const [key, cutout] of Object.entries(this.cutouts)) {
      if (!this.isSectorVisible(key)) continue;
      const marker = document.createElement("img");
      marker.className = "overlay-strongpoint";
      marker.src = cutout.dataUrl;
      marker.alt = "";
      marker.draggable = false;
      Object.assign(marker.style, cutoutStyle, {
        left: `${(cutout.left / STRONGPOINT_MAP_SIZE) * 100}%`,
        top: `${(cutout.top / STRONGPOINT_MAP_SIZE) * 100}%`,
        width: `${(cutout.width / STRONGPOINT_MAP_SIZE) * 100}%`,
        height: `${(cutout.height / STRONGPOINT_MAP_SIZE) * 100}%`,
      });
      this.spCutoutsLayer.appendChild(marker);
    }
  }

  async renderStrongpoints(buildId) {
    const mapId = this.mapId;
    this.spCutoutsLayer.innerHTML = "";
    this.spLabelsLayer.innerHTML = "";

    if (!this.toggles.strongpoints || !mapId || buildId !== this.renderBuildId) return;

    const spImage = await loadImage(`/maps/points/${mapId}_SP_NoMap2.png`);
    if (buildId !== this.renderBuildId || mapId !== this.mapId) return;

    this.cutouts = this.buildCutouts(spImage);
    this.renderCutouts();

    if (!this.toggles.strongpointNames) return;
    if (!this.strongpointNames?.[mapId]) return;

    const labelBuildId = ++this.labelBuildId;
    const labels = this.strongpointNames[mapId];
    const [fullImage, bareImage] = await Promise.all([
      loadImage(`/maps/points/${mapId}_SP_NoMap.png`),
      spImage,
    ]);

    if (labelBuildId !== this.labelBuildId || buildId !== this.renderBuildId || mapId !== this.mapId) {
      return;
    }

    for (const [key, label] of Object.entries(labels)) {
      if (!this.isSectorVisible(key)) continue;
      const src = await resolveLabelSrc(label, fullImage, bareImage);
      if (!src || labelBuildId !== this.labelBuildId) continue;

      const marker = document.createElement("img");
      marker.className = "overlay-strongpoint-label";
      marker.src = src;
      marker.alt = "";
      marker.draggable = false;
      Object.assign(marker.style, labelStyle, {
        left: `${label.left}%`,
        top: `${label.top}%`,
        width: `${label.width}%`,
        height: `${label.height}%`,
      });
      this.spLabelsLayer.appendChild(marker);
    }
  }

  destroy() {
    this.renderBuildId += 1;
    this.labelBuildId += 1;
    this.gridLayer.remove();
    this.strongpointsLayer.remove();
    this.accessibilityLayer.remove();
  }
}
