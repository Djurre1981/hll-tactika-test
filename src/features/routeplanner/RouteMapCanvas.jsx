import { useEffect, useRef } from "react";
import MapKernel from "@map-kernel";

/**
 * Map canvas for routeplanner — pan/zoom only; routes draw in RouteOverlay SVG.
 * Accessibility PNG overlay is replaced by vector obstacles in ObstacleOverlay.
 */
export function RouteMapCanvas({
  kernelRef,
  mapId,
  panelInsets,
  onKernelReady,
  onMapClick,
  onMapPointerDown,
  onMapPointerMove,
  onMapDoubleClick,
  className = "",
}) {
  const hostRef = useRef(null);
  const localKernel = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const kernel = new MapKernel({ mapId });
    kernel.mount(host);
    kernel.setTool({ tool: "select" });
    kernel.setOverlays({
      grid: true,
      strongpoints: false,
      accessibility: false,
    });

    // Routeplanner draws routes in SVG — hide empty strat canvases (4096² layers).
    if (kernel.canvas) kernel.canvas.style.display = "none";
    if (kernel.animCanvas) kernel.animCanvas.style.display = "none";

    localKernel.current = kernel;
    if (kernelRef) kernelRef.current = kernel;
    if (panelInsets) kernel.setPanelInsets(panelInsets);
    onKernelReady?.(kernel);
    kernel.fitToView();

    const ro = new ResizeObserver(() => {
      if (host.clientWidth > 0 && host.clientHeight > 0) kernel.fitToView();
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      kernel.destroy();
      localKernel.current = null;
      if (kernelRef) kernelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, [kernelRef]);

  useEffect(() => {
    localKernel.current?.setMap(mapId);
    localKernel.current?.fitToView();
  }, [mapId]);

  useEffect(() => {
    const kernel = localKernel.current;
    if (!kernel || !panelInsets) return;
    kernel.setPanelInsets(panelInsets);
    kernel.fitToView();
  }, [panelInsets]);

  useEffect(() => {
    const kernel = localKernel.current;
    const viewport = kernel?.getViewport?.();
    if (!viewport) return undefined;

    const handlePointerDown = (event) => {
      if (event.button !== 0 || !onMapPointerDown) return;
      const pt = kernel.screenToMapPercent(event.clientX, event.clientY);
      if (pt) onMapPointerDown(pt, event);
    };

    if (onMapPointerDown) {
      viewport.addEventListener("pointerdown", handlePointerDown);
    }
    return () => {
      viewport.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onMapPointerDown]);

  useEffect(() => {
    const kernel = localKernel.current;
    const viewport = kernel?.getViewport?.();
    if (!viewport || !onMapClick) return undefined;

    const handleClick = (event) => {
      if (event.button !== 0) return;
      const pt = kernel.screenToMapPercent(event.clientX, event.clientY);
      if (pt) onMapClick(pt, event);
    };

    const handleMove = (event) => {
      if (!onMapPointerMove) return;
      const pt = kernel.screenToMapPercent(event.clientX, event.clientY);
      if (pt) onMapPointerMove(pt, event);
    };

    viewport.addEventListener("click", handleClick);
    if (onMapPointerMove) viewport.addEventListener("pointermove", handleMove);
    return () => {
      viewport.removeEventListener("click", handleClick);
      viewport.removeEventListener("pointermove", handleMove);
    };
  }, [onMapClick, onMapPointerMove]);

  useEffect(() => {
    const kernel = localKernel.current;
    const viewport = kernel?.getViewport?.();
    if (!viewport || !onMapDoubleClick) return undefined;

    const handleDoubleClick = (event) => {
      if (event.button !== 0) return;
      const pt = kernel.screenToMapPercent(event.clientX, event.clientY);
      if (pt) onMapDoubleClick(pt, event);
    };

    viewport.addEventListener("dblclick", handleDoubleClick);
    return () => viewport.removeEventListener("dblclick", handleDoubleClick);
  }, [onMapDoubleClick]);

  return <div ref={hostRef} className={`h-full w-full min-h-0 ${className}`} />;
}
