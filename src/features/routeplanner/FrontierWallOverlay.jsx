import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getFrontierWallLine } from "./timing/frontier-wall.js";

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

export function FrontierWallOverlay({ kernelRef, kernelReady = false, hqSide, visible = true }) {
  const { imgW, imgH } = useMapImageSize(kernelRef, kernelReady);
  if (!visible || !kernelReady || !imgW || !imgH || !hqSide) return null;

  const wall = getFrontierWallLine(hqSide);
  if (!wall) return null;

  const kernel = kernelRef.current;
  const stage = kernel?.getStage();
  if (!kernel || !stage) return null;

  const xPx = (wall.value / 100) * imgW;

  return createPortal(
    <svg
      className="routeplanner-frontier-wall"
      width={imgW}
      height={imgH}
      viewBox={`0 0 ${imgW} ${imgH}`}
      aria-hidden="true"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 4,
      }}
    >
      <line
        x1={xPx}
        y1={0}
        x2={xPx}
        y2={imgH}
        stroke="rgba(251, 191, 36, 0.85)"
        strokeWidth={Math.max(2, imgW / 512)}
        strokeDasharray={`${imgW / 64} ${imgW / 128}`}
      />
      <text
        x={xPx + imgW / 256}
        y={imgH * 0.04}
        fill="rgba(251, 191, 36, 0.9)"
        fontSize={Math.max(10, imgW / 128)}
        fontWeight="600"
      >
        Frontier wall
      </text>
    </svg>,
    stage
  );
}
