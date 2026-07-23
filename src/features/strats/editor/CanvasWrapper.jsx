import { useEffect, useRef } from "react";
import MapKernel from "@map-kernel";
import { useEditorStore } from "../../../lib/stores/useEditorStore.js";
import { useToolStore } from "../../../lib/stores/useToolStore.js";

function toolSettingsFromStore(state) {
  return {
    tool: state.tool,
    color: state.color,
    size: state.strokeWidth,
    lineType: state.lineType,
    endType: state.endType,
    startCap: state.startCap,
    endCap: state.endCap,
    opacity: state.opacity,
    startSize: state.startSize,
    endSize: state.endSize,
    lineBezier: state.lineBezier,
    filled: state.filled,
    fontSize: state.fontSize,
    textStyle: state.textStyle,
    textAlign: state.textAlign,
    fontFamily: state.fontFamily,
    bold: state.bold,
    italic: state.italic,
    underline: state.underline,
    textVAlign: state.textVAlign,
    outlineColor: state.outlineColor,
    outlineWidth: state.outlineWidth,
    shadow: state.shadow,
    padding: state.padding,
    rotation: state.rotation,
    eyedropTarget: state.eyedropTarget,
    iconId: state.iconId,
    iconLabel: state.iconLabel,
    hllId: state.hllId,
    hllShowRadius: state.hllShowRadius,
    hllRadiusCheck: state.hllRadiusCheck,
  };
}

function applySlideBackground(kernel, { rasterUrl, rasterFit, customBackgroundPending, mapId }) {
  if (rasterUrl) {
    kernel.setStratCustomBackground(rasterUrl, { fit: rasterFit || "contain" });
    return;
  }
  if (customBackgroundPending) {
    kernel.setStratGroundOnly();
    return;
  }
  if (mapId) {
    kernel.setMap(mapId);
  }
}

/**
 * Sole React bridge to @map-kernel. Exposes kernel via `kernelRef`.
 * Camera stays inside the kernel (no Zustand round-trip — that was distorting fit).
 */
export function CanvasWrapper({
  kernelRef,
  mapId,
  rasterUrl,
  rasterFit = "contain",
  customBackgroundPending = false,
  slideKey,
  objects,
  locked = false,
  panelInsets,
  visibleStrongpoints,
  onSelectionChange,
  className = "",
}) {
  const hostRef = useRef(null);
  const localKernel = useRef(null);
  const selectionCb = useRef(onSelectionChange);
  selectionCb.current = onSelectionChange;
  const fittedRef = useRef(false);
  const overlayLockRef = useRef(false);
  const bgRef = useRef({ rasterUrl, rasterFit, customBackgroundPending, mapId });
  overlayLockRef.current = Boolean(rasterUrl || customBackgroundPending);
  bgRef.current = { rasterUrl, rasterFit, customBackgroundPending, mapId };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    fittedRef.current = false;
    const kernel = new MapKernel({
      onSelectionChange: (selected) => {
        useEditorStore.getState().setSelectedObjectId(selected?.id || null);
        selectionCb.current?.(selected);
      },
      onRequestTool: (tool) => {
        useToolStore.getState().setTool(tool);
      },
      onEyedrop: (hex, target) => {
        const store = useToolStore.getState();
        const stylePartial =
          target === "outline" ? { outlineColor: hex } : { color: hex };
        store.patch({ ...stylePartial, eyedropTarget: null });
        const selected = kernel.scene?.getSelected?.();
        if (selected?.type === "text") {
          kernel.scene.updateObject(
            selected.id,
            (obj) => ({
              ...obj,
              style: { ...obj.style, ...stylePartial },
            }),
            { pushUndo: true }
          );
        }
      },
    });
    kernel.mount(host);
    kernel.setTool(toolSettingsFromStore(useToolStore.getState()));
    applySlideBackground(kernel, bgRef.current);
    const ed = useEditorStore.getState();
    const lockOverlays = overlayLockRef.current;
    kernel.setOverlays({
      grid: lockOverlays ? false : ed.showGrid,
      strongpoints: lockOverlays ? false : ed.showStrongpoints,
      strongpointNames: lockOverlays ? false : ed.showStrongpointNames,
      accessibility: lockOverlays ? false : ed.showAccessibility,
    });
    localKernel.current = kernel;
    if (kernelRef) kernelRef.current = kernel;

    const unsubTool = useToolStore.subscribe((state) => {
      kernel.setTool(toolSettingsFromStore(state));
    });
    const unsubEditor = useEditorStore.subscribe((state) => {
      if (overlayLockRef.current) return;
      kernel.setOverlays({
        grid: state.showGrid,
        strongpoints: state.showStrongpoints,
        strongpointNames: state.showStrongpointNames,
        accessibility: state.showAccessibility,
      });
    });

    // Refit when the host actually has layout size (flex/absolute race).
    const ro = new ResizeObserver(() => {
      if (!fittedRef.current && host.clientWidth > 0 && host.clientHeight > 0) {
        fittedRef.current = true;
        kernel.fitToView();
      }
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      unsubTool();
      unsubEditor();
      kernel.destroy();
      localKernel.current = null;
      if (kernelRef) kernelRef.current = null;
    };
  }, [kernelRef]);

  useEffect(() => {
    const kernel = localKernel.current;
    if (!kernel) return;
    applySlideBackground(kernel, bgRef.current);
  }, [mapId, rasterUrl, rasterFit, customBackgroundPending, slideKey]);

  useEffect(() => {
    localKernel.current?.setLocked(locked);
  }, [locked]);

  useEffect(() => {
    if (!localKernel.current || !panelInsets) return;
    localKernel.current.setPanelInsets(panelInsets);
  }, [panelInsets]);

  useEffect(() => {
    localKernel.current?.setVisibleStrongpoints(visibleStrongpoints);
  }, [visibleStrongpoints]);

  useEffect(() => {
    if (!localKernel.current || !slideKey) return;
    localKernel.current.loadSlide(objects || []);
    applySlideBackground(localKernel.current, bgRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only on slide change
  }, [slideKey]);

  return <div ref={hostRef} className={`h-full w-full min-h-0 ${className}`} />;
}
