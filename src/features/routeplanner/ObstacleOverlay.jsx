import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  bboxFromPoints,
  getObstacleAnchors,
  isNearPoint,
  polygonPointsAttr,
  PEN_CLOSE_THRESHOLD,
} from "./obstacles/obstacle-shapes.js";

function mapPctToPx(x, y, imgW, imgH) {
  return { x: (x / 100) * imgW, y: (y / 100) * imgH };
}

function overlayMetrics(imgW, imgH) {
  const s = Math.max(imgW, imgH) / 4096;
  return {
    handleRadius: 8 * s,
    handleStroke: 3 * s,
    anchorRadius: 6 * s,
    dash: 6 * s,
  };
}

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

function ObstacleShape({ obstacle, imgW, imgH, selected, hovered, editMode, patternId, shapePointerEvents }) {
  const isClear = obstacle.effect === "clear";
  const fromAccessibility = obstacle.source === "accessibility";

  const fill = isClear
    ? "rgba(34, 197, 94, 0.22)"
    : fromAccessibility
      ? `url(#${patternId})`
      : "rgba(239, 68, 68, 0.48)";
  const fillOpacity = isClear ? 1 : fromAccessibility ? 0.85 : 1;
  const stroke =
    selected && editMode
      ? "#ffffff"
      : hovered && editMode
        ? "rgba(255, 255, 255, 0.85)"
        : fromAccessibility
          ? "rgba(252, 165, 165, 0.95)"
          : "rgba(220, 38, 38, 0.9)";
  const strokeWidth = selected && editMode ? 3 : hovered && editMode ? 2.5 : fromAccessibility ? 2.5 : 2;
  const pointerStyle = {
    pointerEvents: shapePointerEvents ? "auto" : "none",
    cursor: shapePointerEvents ? "pointer" : "default",
  };

  if (obstacle.type === "polygon" && obstacle.points.length >= 3) {
    return (
      <polygon
        points={polygonPointsAttr(obstacle.points, imgW, imgH)}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={isClear ? "6 4" : undefined}
        style={pointerStyle}
      />
    );
  }

  const box = bboxFromPoints(obstacle.points);
  const x = mapPctToPx(box.x1, box.y1, imgW, imgH);
  const w = mapPctToPx(box.x2, box.y2, imgW, imgH).x - x.x;
  const h = mapPctToPx(box.x2, box.y2, imgW, imgH).y - x.y;

  if (obstacle.type === "ellipse") {
    return (
      <ellipse
        cx={x.x + w / 2}
        cy={x.y + h / 2}
        rx={Math.abs(w) / 2}
        ry={Math.abs(h) / 2}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={isClear ? "6 4" : undefined}
        style={pointerStyle}
      />
    );
  }

  return (
    <rect
      x={x.x}
      y={x.y}
      width={w}
      height={h}
      fill={fill}
      fillOpacity={fillOpacity}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={isClear ? "6 4" : undefined}
      style={pointerStyle}
    />
  );
}

function AnchorHandle({
  anchor,
  imgW,
  imgH,
  metrics,
  selected,
  onPointerDown,
}) {
  const pos = mapPctToPx(anchor.x, anchor.y, imgW, imgH);
  const radius = selected ? metrics.handleRadius : metrics.anchorRadius;

  return (
    <circle
      cx={pos.x}
      cy={pos.y}
      r={radius}
      fill={selected ? "#ffffff" : "#dc2626"}
      stroke={selected ? "#dc2626" : "#fff"}
      strokeWidth={metrics.handleStroke}
      style={{ pointerEvents: "auto", cursor: selected ? "grab" : "pointer" }}
      onPointerDown={onPointerDown}
    />
  );
}

function PenEditHint({ target, imgW, imgH, metrics }) {
  if (!target?.point || (target.mode !== "add" && target.mode !== "delete")) return null;

  const pos = mapPctToPx(target.point.x, target.point.y, imgW, imgH);
  const isAdd = target.mode === "add";
  const radius = metrics.handleRadius * 1.05;
  const label = isAdd ? "+" : "−";

  return (
    <g className="routeplanner-pen-edit-hint" aria-hidden="true">
      <circle
        cx={pos.x}
        cy={pos.y}
        r={radius}
        fill={isAdd ? "#ffffff" : "#fecaca"}
        stroke={isAdd ? "#22c55e" : "#dc2626"}
        strokeWidth={metrics.handleStroke}
        style={{ pointerEvents: "none" }}
      />
      <text
        x={pos.x}
        y={pos.y}
        textAnchor="middle"
        dominantBaseline="central"
        fill={isAdd ? "#15803d" : "#991b1b"}
        fontSize={radius * 1.35}
        fontWeight="700"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {label}
      </text>
    </g>
  );
}

function PenDrawPreview({ preview, imgW, imgH, metrics, patternId }) {
  if (!preview?.points?.length) return null;

  const isClear = preview.effect === "clear";
  const stroke = isClear ? "rgba(34, 197, 94, 0.95)" : "rgba(252, 165, 165, 0.95)";
  const fill = isClear ? "rgba(34, 197, 94, 0.18)" : `url(#${patternId})`;
  const placed = preview.points;
  const cursor = preview.cursor;
  const nearClose =
    placed.length >= 3 && cursor && isNearPoint(cursor, placed[0], PEN_CLOSE_THRESHOLD);
  const rubberPoints =
    cursor && placed.length
      ? [...placed, nearClose ? placed[0] : cursor]
      : placed;

  return (
    <g className="routeplanner-pen-preview">
      {placed.length >= 3 && (
        <polygon
          points={polygonPointsAttr(placed, imgW, imgH)}
          fill={fill}
          fillOpacity={0.5}
          stroke={stroke}
          strokeWidth={2}
          strokeDasharray="6 4"
          style={{ pointerEvents: "none" }}
        />
      )}
      <polyline
        points={polygonPointsAttr(rubberPoints, imgW, imgH)}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeDasharray={placed.length >= 3 && nearClose ? undefined : "4 3"}
        style={{ pointerEvents: "none" }}
      />
      {placed.map((point, index) => {
        const pos = mapPctToPx(point.x, point.y, imgW, imgH);
        const isFirst = index === 0;
        const r = isFirst && nearClose ? metrics.handleRadius * 1.2 : metrics.anchorRadius;
        return (
          <circle
            key={`pen-pt-${index}`}
            cx={pos.x}
            cy={pos.y}
            r={r}
            fill={isFirst && placed.length >= 3 ? "#ffffff" : "#dc2626"}
            stroke="#fff"
            strokeWidth={metrics.handleStroke}
            style={{ pointerEvents: "none" }}
          />
        );
      })}
    </g>
  );
}

export function ObstacleOverlay({
  kernelRef,
  kernelReady = false,
  obstacles = [],
  visible = false,
  editMode = false,
  obstacleTool = "select",
  selectedObstacleId,
  drawPreview,
  penPreview,
  penHoverTarget,
  onObstaclePointerDown,
  onAnchorPointerDown,
}) {
  const { imgW, imgH } = useMapImageSize(kernelRef, kernelReady);
  const [hoveredObstacleId, setHoveredObstacleId] = useState(null);

  useEffect(() => {
    if (!editMode) setHoveredObstacleId(null);
  }, [editMode]);

  if (!kernelReady || !imgW || !imgH || !visible) return null;
  if (!obstacles.length && !penPreview) return null;

  const kernel = kernelRef.current;
  const stage = kernel?.getStage();
  if (!kernel || !stage) return null;

  const m = overlayMetrics(imgW, imgH);
  const patternId = "routeplanner-obstacle-hatch";
  const anchorObstacleId = selectedObstacleId || hoveredObstacleId;
  const anchorObstacle = obstacles.find((o) => o.id === anchorObstacleId);
  const penDrawing = editMode && obstacleTool === "pen";
  const shapePointerEvents = editMode && !penDrawing;
  return createPortal(
    <svg
      className="routeplanner-obstacles"
      width={imgW}
      height={imgH}
      viewBox={`0 0 ${imgW} ${imgH}`}
      aria-hidden={!editMode}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <defs>
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={12}
          height={12}
          patternTransform="rotate(45)"
        >
          <rect width="12" height="12" fill="rgba(239, 68, 68, 0.22)" />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="12"
            stroke="rgba(220, 38, 38, 0.75)"
            strokeWidth="2"
          />
        </pattern>
      </defs>

      {obstacles.map((obstacle) => (
        <g
          key={obstacle.id}
          onPointerEnter={() => {
            if (!editMode) return;
            setHoveredObstacleId(obstacle.id);
          }}
          onPointerLeave={() => {
            setHoveredObstacleId((current) => (current === obstacle.id ? null : current));
          }}
          onPointerDown={(e) => {
            if (!editMode) return;
            e.stopPropagation();
            onObstaclePointerDown?.(obstacle.id, e);
          }}
        >
          <ObstacleShape
            obstacle={obstacle}
            imgW={imgW}
            imgH={imgH}
            selected={obstacle.id === selectedObstacleId}
            hovered={obstacle.id === hoveredObstacleId && obstacle.id !== selectedObstacleId}
            editMode={editMode}
            patternId={patternId}
            shapePointerEvents={shapePointerEvents}
          />
        </g>
      ))}

      {penPreview && (
        <PenDrawPreview
          preview={penPreview}
          imgW={imgW}
          imgH={imgH}
          metrics={m}
          patternId={patternId}
        />
      )}

      {penHoverTarget && (
        <PenEditHint target={penHoverTarget} imgW={imgW} imgH={imgH} metrics={m} />
      )}

      {drawPreview && (
        <ObstacleShape
          obstacle={drawPreview}
          imgW={imgW}
          imgH={imgH}
          selected
          editMode
          patternId={patternId}
        />
      )}

      {editMode && anchorObstacle && !penDrawing && (
        <g key={`anchors-${anchorObstacle.id}`}>
          {getObstacleAnchors(anchorObstacle).map((anchor) => (
            <AnchorHandle
              key={`${anchorObstacle.id}-${anchor.id}`}
              anchor={anchor}
              imgW={imgW}
              imgH={imgH}
              metrics={m}
              selected={anchorObstacle.id === selectedObstacleId}
              onPointerDown={(e) => {
                e.stopPropagation();
                onAnchorPointerDown?.(anchorObstacle.id, anchor, e);
              }}
            />
          ))}
        </g>
      )}

      {editMode && anchorObstacle && anchorObstacle.type !== "polygon" && !penDrawing && (
        <g>
          {(() => {
            const box = bboxFromPoints(anchorObstacle.points);
            const tl = mapPctToPx(box.x1, box.y1, imgW, imgH);
            const br = mapPctToPx(box.x2, box.y2, imgW, imgH);
            return (
              <rect
                x={tl.x}
                y={tl.y}
                width={br.x - tl.x}
                height={br.y - tl.y}
                fill="none"
                stroke="rgba(255,255,255,0.75)"
                strokeWidth={m.dash * 0.4}
                strokeDasharray={`${m.dash} ${m.dash}`}
                style={{ pointerEvents: "none" }}
              />
            );
          })()}
        </g>
      )}
    </svg>,
    stage
  );
}
