import { useEffect, useRef } from "react";
import MapKernel from "@map-kernel";
import { useToolStore } from "../../lib/stores/useToolStore.js";
import { defaultPageUrl } from "./microPrepPages.js";

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

/**
 * Map-kernel bridge for micro-prep whiteboard / slideshow (custom page image, not HLL map id).
 */
export function MicroPrepCanvasWrapper({
  kernelRef,
  slideKey,
  objects,
  pageUrl = null,
  theme = "dark",
  slideshow = false,
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
  const pageUrlRef = useRef(pageUrl);
  pageUrlRef.current = pageUrl;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    fittedRef.current = false;
    const kernel = new MapKernel({
      onSelectionChange: (selected) => {
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
    kernel.setPageMode(slideshow ? "slideshow" : "square");
    kernel.setTool(toolSettingsFromStore(useToolStore.getState()));
    const initialPage =
      pageUrlRef.current || defaultPageUrl(theme, slideshow);
    kernel.setPageImage(initialPage);
    localKernel.current = kernel;
    if (kernelRef) kernelRef.current = kernel;

    const unsubTool = useToolStore.subscribe((state) => {
      kernel.setTool(toolSettingsFromStore(state));
    });

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
      kernel.destroy();
      localKernel.current = null;
      if (kernelRef) kernelRef.current = null;
    };
  }, [kernelRef, slideshow]);

  useEffect(() => {
    localKernel.current?.setLocked(locked);
  }, [locked]);

  useEffect(() => {
    if (!localKernel.current || !panelInsets) return;
    localKernel.current.setPanelInsets(panelInsets);
  }, [panelInsets]);

  useEffect(() => {
    const kernel = localKernel.current;
    if (!kernel) return;
    const url = pageUrl || defaultPageUrl(theme, slideshow);
    kernel.setPageImage(url);
    kernel.fitToView();
  }, [pageUrl, theme, slideshow]);

  useEffect(() => {
    if (!localKernel.current || !slideKey) return;
    localKernel.current.loadSlide(objects || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only on slide change
  }, [slideKey]);

  return <div ref={hostRef} className={`h-full w-full min-h-0 ${className}`} />;
}
