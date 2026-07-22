import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function useMapImageSize(kernelRef, kernelReady) {
  const [size, setSize] = useState({ imgW: 0, imgH: 0 });

  useEffect(() => {
    if (!kernelReady) return undefined;
    const kernel = kernelRef.current;
    if (!kernel) return undefined;

    const update = () => {
      const { imgW, imgH } = kernel.getImageSize();
      if (imgW > 0 && imgH > 0) setSize({ imgW, imgH });
    };

    update();
    const img = kernel.getMapImage();
    img?.addEventListener("load", update);
    return () => img?.removeEventListener("load", update);
  }, [kernelRef, kernelReady]);

  return size;
}

/** Semi-transparent veil over the map image (obstacle edit focus mode). */
export function MapDimOverlay({ kernelRef, kernelReady = false, visible = false, dim = 0.5 }) {
  const { imgW, imgH } = useMapImageSize(kernelRef, kernelReady);
  if (!kernelReady || !imgW || !imgH || !visible) return null;

  const kernel = kernelRef.current;
  const stage = kernel?.getStage();
  if (!kernel || !stage) return null;

  return createPortal(
    <div
      className="routeplanner-map-dim"
      aria-hidden="true"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: imgW,
        height: imgH,
        background: `rgba(0, 0, 0, ${dim})`,
        pointerEvents: "none",
        zIndex: 4,
      }}
    />,
    stage
  );
}
