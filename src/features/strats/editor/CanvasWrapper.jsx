import { useEffect, useRef } from "react";
import MapKernel from "@map-kernel";
import { useCameraStore } from "../../../lib/stores/useCameraStore.js";
import { useEditorStore } from "../../../lib/stores/useEditorStore.js";
import { useToolStore } from "../../../lib/stores/useToolStore.js";

function toolSettingsFromStore(state) {
  return {
    tool: state.tool,
    color: state.color,
    size: state.strokeWidth,
    lineType: state.lineType,
    endType: state.endType,
    filled: state.filled,
    fontSize: state.fontSize,
    textStyle: state.textStyle,
    textAlign: state.textAlign,
    iconId: state.iconId,
    iconLabel: state.iconLabel,
  };
}

/**
 * Sole React bridge to @map-kernel. Exposes kernel via `kernelRef`.
 */
export function CanvasWrapper({
  kernelRef,
  mapId,
  slideKey,
  objects,
  locked = false,
  panelInsets,
  onSelectionChange,
  className = "",
}) {
  const hostRef = useRef(null);
  const localKernel = useRef(null);
  const applyingCamera = useRef(false);
  const selectionCb = useRef(onSelectionChange);
  selectionCb.current = onSelectionChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const kernel = new MapKernel({
      onSelectionChange: (selected) => {
        useEditorStore.getState().setSelectedObjectId(selected?.id || null);
        selectionCb.current?.(selected);
      },
      onCameraChange: (camera) => {
        if (applyingCamera.current) return;
        useCameraStore.getState().setCamera(camera);
      },
    });
    kernel.mount(host);
    kernel.setTool(toolSettingsFromStore(useToolStore.getState()));
    const ed = useEditorStore.getState();
    kernel.setOverlays({ grid: ed.showGrid, strongpoints: ed.showStrongpoints });
    localKernel.current = kernel;
    if (kernelRef) kernelRef.current = kernel;

    const unsubTool = useToolStore.subscribe((state) => {
      kernel.setTool(toolSettingsFromStore(state));
    });
    const unsubCamera = useCameraStore.subscribe((state) => {
      applyingCamera.current = true;
      kernel.setCamera({ x: state.x, y: state.y, zoom: state.zoom });
      applyingCamera.current = false;
    });
    const unsubEditor = useEditorStore.subscribe((state) => {
      kernel.setOverlays({
        grid: state.showGrid,
        strongpoints: state.showStrongpoints,
      });
    });

    return () => {
      unsubTool();
      unsubCamera();
      unsubEditor();
      kernel.destroy();
      localKernel.current = null;
      if (kernelRef) kernelRef.current = null;
    };
  }, [kernelRef]);

  useEffect(() => {
    localKernel.current?.setMap(mapId);
  }, [mapId]);

  useEffect(() => {
    localKernel.current?.setLocked(locked);
  }, [locked]);

  useEffect(() => {
    if (!localKernel.current || !panelInsets) return;
    localKernel.current.setPanelInsets(panelInsets);
  }, [panelInsets]);

  // Initial fit once insets are known after mount
  const fittedRef = useRef(false);
  useEffect(() => {
    if (!localKernel.current || !panelInsets) return;
    if (fittedRef.current) return;
    if (panelInsets.left > 0 || panelInsets.right > 0) {
      fittedRef.current = true;
      localKernel.current.fitToView();
    }
  }, [panelInsets]);

  useEffect(() => {
    if (!localKernel.current || !slideKey) return;
    localKernel.current.loadSlide(objects || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only on slide change
  }, [slideKey]);

  return <div ref={hostRef} className={`h-full w-full min-h-0 ${className}`} />;
}
