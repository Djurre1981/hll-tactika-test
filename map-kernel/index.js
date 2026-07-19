import { MapViewer } from "./MapViewer.js";
import { SceneGraph } from "./SceneGraph.js";
import { CanvasRenderer } from "./CanvasRenderer.js";
import { InteractionController } from "./InteractionController.js";
import { MapOverlays } from "./MapOverlays.js";
import { getHllObjectDef, hllBoxFromCenter } from "./object-schema.js";

function mapUrlForId(mapId) {
  if (!mapId) return "";
  if (mapId.startsWith("/") || mapId.startsWith("http")) return mapId;
  return `/maps/no-grid/${mapId}_NoGrid.webp`;
}

/**
 * Imperative map + drawing kernel. React must only touch this via CanvasWrapper.
 */
export class MapKernel {
  constructor(options = {}) {
    this.options = options;
    this.root = null;
    this.viewer = null;
    this.renderer = null;
    this.overlays = null;
    this.scene = new SceneGraph();
    this.interaction = null;
    this.currentMapId = null;
    this.toolSettings = {
      tool: "select",
      color: "#ffffff",
      size: 3,
      lineType: "solid",
      endType: "none",
      startCap: "none",
      endCap: "none",
      opacity: 100,
      startSize: 5,
      endSize: 6,
      lineBezier: false,
      filled: true,
      fontSize: 10,
      textStyle: 0,
      textAlign: "center",
      iconId: "check",
      iconLabel: "",
      hllId: "garrison",
      hllShowRadius: true,
      hllRadiusCheck: true,
    };
    this.onObjectsChange = options.onObjectsChange || null;
    this.onSelectionChange = options.onSelectionChange || null;
    this.onCameraChange = options.onCameraChange || null;
    this.onRequestTool = options.onRequestTool || null;

    this.scene.onChange = (objects, meta) => {
      this.renderer?.requestDraw(objects);
      this.onObjectsChange?.(objects, meta);
    };
    this.scene.onSelectionChange = (selected) => {
      this.renderer?.setSelectedId(selected?.id || null);
      this.renderer?.requestDraw(this.scene.getObjects());
      this.onSelectionChange?.(selected);
    };
  }

  mount(el) {
    if (this.root) this.destroy();
    this.root = el;
    el.innerHTML = "";
    el.style.position = "relative";
    el.style.overflow = "hidden";
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.touchAction = "none";
    el.style.background = "transparent";

    this.viewport = document.createElement("div");
    this.viewport.className = "map-kernel-viewport";
    Object.assign(this.viewport.style, {
      position: "absolute",
      inset: "0",
      overflow: "hidden",
      cursor: "grab",
    });

    this.stage = document.createElement("div");
    this.stage.className = "map-kernel-stage";
    Object.assign(this.stage.style, {
      position: "absolute",
      left: "0",
      top: "0",
      transformOrigin: "0 0",
      willChange: "transform",
    });

    this.image = document.createElement("img");
    this.image.alt = "Map";
    this.image.draggable = false;
    Object.assign(this.image.style, {
      display: "block",
      maxWidth: "none",
      width: "auto",
      height: "auto",
      userSelect: "none",
      pointerEvents: "none",
      WebkitUserDrag: "none",
    });

    const overlayStyle = {
      position: "absolute",
      left: "0",
      top: "0",
      pointerEvents: "none",
    };

    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, overlayStyle);

    this.animCanvas = document.createElement("canvas");
    Object.assign(this.animCanvas.style, overlayStyle);

    this.stage.appendChild(this.image);
    this.stage.appendChild(this.canvas);
    this.stage.appendChild(this.animCanvas);
    this.viewport.appendChild(this.stage);
    el.appendChild(this.viewport);

    this.overlays = new MapOverlays(this.stage, this.image);

    this.viewer = new MapViewer(this.viewport, this.stage, this.image);
    this.viewer.onTransform = (camera) => {
      this.renderer?.setViewScale(camera?.zoom);
      this.syncPanBlock();
      this.onCameraChange?.(camera);
    };

    this.renderer = new CanvasRenderer(this.canvas, {
      animCanvas: this.animCanvas,
      getObjects: () => this.scene.getObjects(),
      getToolSettings: () => this.toolSettings,
    });
    this.interaction = new InteractionController({
      scene: this.scene,
      renderer: this.renderer,
      getViewer: () => this.viewer,
      getToolSettings: () => this.toolSettings,
      onRequestRender: () => this.renderer.requestDraw(this.scene.getObjects()),
      onRequestTool: (tool) => this.onRequestTool?.(tool),
    });
    this.interaction.attach(this.viewport);

    this.image.addEventListener("load", () => {
      const w = this.image.naturalWidth || 4096;
      const h = this.image.naturalHeight || w;
      // Intrinsic size only — never force a fake 1920 box (maps are 4096²).
      this.image.removeAttribute("width");
      this.image.removeAttribute("height");
      this.image.style.width = `${w}px`;
      this.image.style.height = `${h}px`;
      this.renderer.setMapSize(w);
      this.overlays?.syncSize();
      this.viewer.fitToView();
      this.renderer.requestDraw(this.scene.getObjects());
    });

    if (this.options.mapId) {
      this.setMap(this.options.mapId);
    }
  }

  destroy() {
    this.interaction?.detach();
    this.renderer?.destroy();
    this.overlays?.destroy();
    this.viewer?.destroy();
    if (this.root) this.root.innerHTML = "";
    this.root = null;
    this.viewer = null;
    this.renderer = null;
    this.overlays = null;
    this.interaction = null;
  }

  syncPanBlock() {
    const block = this.interaction?.shouldBlockPan() || false;
    this.viewer?.setBlockPan(block);
    if (this.viewport) {
      this.viewport.style.cursor = block ? "crosshair" : "grab";
    }
  }

  setMap(mapId) {
    const url = mapUrlForId(mapId);
    if (!url || !this.image) return;
    this.currentMapId = mapId;
    this.overlays?.setMapId(mapId);
    if (this.image.src.endsWith(url) || this.image.getAttribute("src") === url) {
      this.viewer?.fitToView();
      return;
    }
    this.image.src = url;
  }

  setPanelInsets(insets) {
    this.viewer?.setPanelInsets(insets);
    if (!this.viewer) return;
    const { imgW } = this.viewer.getImageSize();
    if (!imgW) return;
    const bounds = this.viewer.getVisibleBounds();
    this.viewer.translateX = bounds.centerX - (imgW * this.viewer.scale) / 2;
    this.viewer.clampTranslation();
    this.viewer.applyTransform();
  }

  fitToView() {
    this.viewer?.fitToView();
  }

  setOverlays(toggles) {
    this.overlays?.setToggles(toggles);
  }

  setCamera(camera) {
    this.viewer?.setCamera(camera);
  }

  getCamera() {
    return this.viewer?.getCamera() || { x: 0, y: 0, zoom: 1 };
  }

  setTool(settings = {}) {
    const prevShowRadius = this.toolSettings.hllShowRadius !== false;
    this.toolSettings = { ...this.toolSettings, ...settings };
    if (settings.tool != null) {
      this.toolSettings.tool = settings.tool;
    }
    this.syncPanBlock();
    this.interaction?.onToolSettingsChanged?.();

    if (settings.hllShowRadius != null) {
      const nextShowRadius = this.toolSettings.hllShowRadius !== false;
      if (nextShowRadius !== prevShowRadius) {
        this.syncHllRadiusDisplay(nextShowRadius);
      } else {
        this.renderer?.requestDraw(this.scene.getObjects());
      }
    }
  }

  /** Live view toggle: swap radius/plain art and resize spawn markers around their center. */
  syncHllRadiusDisplay(showRadius) {
    const objects = this.scene.getObjects();
    let changed = false;
    const nextObjects = objects.map((object) => {
      if (object.type !== "hll") return object;
      const def = getHllObjectDef(object.meta?.hllId);
      if (!def?.hasRadius || object.points?.length < 2) {
        if (object.meta?.showRadius === showRadius) return object;
        changed = true;
        return {
          ...object,
          meta: { ...object.meta, showRadius },
        };
      }
      const cx = (object.points[0].x + object.points[1].x) / 2;
      const cy = (object.points[0].y + object.points[1].y) / 2;
      const points = hllBoxFromCenter(
        { x: cx, y: cy },
        { hllId: object.meta.hllId, showRadius }
      );
      changed = true;
      return {
        ...object,
        points,
        meta: { ...object.meta, showRadius },
      };
    });
    if (changed) {
      this.scene.replaceObjects(nextObjects, { pushUndo: false });
    } else {
      this.renderer?.requestDraw(objects);
    }
  }

  setLocked(locked) {
    this.interaction?.setLocked(locked);
  }

  loadSlide(objects) {
    this.scene.load(objects || []);
    this.renderer?.setSelectedId(null);
    this.renderer?.requestDraw(this.scene.getObjects());
  }

  /**
   * Collab/Yjs inbound sync — preserves selection; skips no-op replaces.
   * @returns {boolean} whether the scene changed
   */
  applyRemoteObjects(objects) {
    const changed = this.scene.syncRemote(objects || []);
    if (!changed) return false;
    this.renderer?.setSelectedId(this.scene.selectedId);
    this.renderer?.requestDraw(this.scene.getObjects());
    return true;
  }

  getObjects() {
    return this.scene.getObjects();
  }

  clearSelection() {
    this.scene.setSelectedId(null);
  }

  undo() {
    this.scene.undo();
    this.renderer?.setSelectedId(this.scene.selectedId);
    this.renderer?.requestDraw(this.scene.getObjects());
  }

  redo() {
    this.scene.redo();
    this.renderer?.setSelectedId(this.scene.selectedId);
    this.renderer?.requestDraw(this.scene.getObjects());
  }

  paste() {
    this.interaction?.paste();
  }

  copy() {
    this.interaction?.copy();
  }

  cut() {
    this.interaction?.cut();
  }

  duplicate() {
    this.interaction?.copy();
    this.interaction?.paste();
  }

  deleteSelected() {
    const selected = this.scene?.getSelected();
    if (!selected) return;
    this.scene.removeObject(selected.id);
    this.renderer?.requestDraw(this.scene.getObjects());
  }

  updateSelected(partial) {
    this.interaction?.updateSelectedStyle(partial);
  }

  setSelectedBezier(enabled) {
    this.interaction?.setSelectedBezier(enabled);
  }

  getSelected() {
    return this.scene.getSelected();
  }
}

export default MapKernel;
