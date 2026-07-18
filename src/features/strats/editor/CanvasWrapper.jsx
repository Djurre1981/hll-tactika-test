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
    filled: state.filled,
    fontSize: state.fontSize,
    textStyle: state.textStyle,
    textAlign: state.textAlign,
    iconId: state.iconId,
    iconLabel: state.iconLabel,
    hllId: state.hllId,
    hllShowRadius: state.hllShowRadius,
    hllRadiusCheck: state.hllRadiusCheck,
  };
}

/**
 * Sole React bridge to @map-kernel. Exposes kernel via `kernelRef`.
 * Camera stays inside the kernel (no Zustand round-trip — that was distorting fit).
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
  const selectionCb = useRef(onSelectionChange);
  selectionCb.current = onSelectionChange;
  const fittedRef = useRef(false);

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
    const unsubEditor = useEditorStore.subscribe((state) => {
      kernel.setOverlays({
        grid: state.showGrid,
        strongpoints: state.showStrongpoints,
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
    localKernel.current?.setMap(mapId);
  }, [mapId]);

  useEffect(() => {
    localKernel.current?.setLocked(locked);
  }, [locked]);

  useEffect(() => {
    if (!localKernel.current || !panelInsets) return;
    localKernel.current.setPanelInsets(panelInsets);
  }, [panelInsets]);

  useEffect(() => {
    if (!localKernel.current || !slideKey) return;
    localKernel.current.loadSlide(objects || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only on slide change
  }, [slideKey]);

  return <div ref={hostRef} className={`h-full w-full min-h-0 ${className}`} />;
}
