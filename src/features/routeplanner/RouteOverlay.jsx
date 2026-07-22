import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getVisibleWaypoints } from "./path/plan-route.js";
import { RouteVehicleMarker } from "./RouteVehicleMarker.jsx";

function mapPctToPx(x, y, imgW, imgH) {
  return { x: (x / 100) * imgW, y: (y / 100) * imgH };
}

/** Sizes in map pixels, scaled so routes stay readable at default zoom. */
function overlayMetrics(imgW, imgH) {
  const s = Math.max(imgW, imgH) / 4096;
  return {
    routeStroke: { normal: 14 * s, highlighted: 18 * s },
    routeHitWidth: 144 * s,
    hqRadius: { normal: 16 * s, active: 22 * s },
    hqStroke: 4 * s,
    waypointRadius: { via: 14 * s, end: 16 * s },
    waypointStroke: 5 * s,
    pendingRadius: 16 * s,
    pendingStroke: 4 * s,
    hqLabelOffset: 22 * s,
    hqLabelSize: 14 * s,
  };
}

function polylinePoints(points, imgW, imgH) {
  if (!points?.length || !imgW || !imgH) return "";
  return points
    .map((p) => {
      const s = mapPctToPx(p.x, p.y, imgW, imgH);
      return `${s.x},${s.y}`;
    })
    .join(" ");
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

function WaypointHandle({
  pos,
  kind,
  state,
  metrics,
  onPointerDown,
  onContextMenu,
}) {
  const { fill, stroke, cursor, scale } = state;
  const r = (kind === "end" ? metrics.waypointRadius.end : metrics.waypointRadius.via) * scale;

  if (kind === "via") {
    return (
      <rect
        x={pos.x - r}
        y={pos.y - r}
        width={r * 2}
        height={r * 2}
        rx={r * 0.25}
        style={{ pointerEvents: "auto", cursor }}
        fill={fill}
        stroke={stroke}
        strokeWidth={metrics.waypointStroke}
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
      />
    );
  }

  return (
    <circle
      cx={pos.x}
      cy={pos.y}
      r={r}
      style={{ pointerEvents: "auto", cursor }}
      fill={fill}
      stroke={stroke}
      strokeWidth={metrics.waypointStroke}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
    />
  );
}

export function RouteOverlay({
  kernelRef,
  kernelReady = false,
  routes,
  factionId,
  hqSpawns,
  selectedHqIndex,
  hoveredRouteId,
  selectedRouteId,
  selectedWaypoint,
  dragPreview,
  pendingEnd,
  onWaypointPointerDown,
  onWaypointContextMenu,
  onRoutePathClick,
}) {
  const { imgW, imgH } = useMapImageSize(kernelRef, kernelReady);
  if (!kernelReady || !imgW || !imgH) return null;

  const kernel = kernelRef.current;
  const stage = kernel?.getStage();
  if (!kernel || !stage) return null;

  const selectedRoute = routes.find((r) => r.id === selectedRouteId);
  const visibleWaypoints = getVisibleWaypoints(selectedRoute);
  const m = overlayMetrics(imgW, imgH);

  return createPortal(
    <svg
      className="routeplanner-overlay"
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
        zIndex: 6,
      }}
    >
      {hqSpawns?.map((hq, index) => {
        const s = mapPctToPx(hq.x, hq.y, imgW, imgH);
        const active = index === selectedHqIndex;
        return (
          <g key={`hq-${index}`}>
            <circle
              cx={s.x}
              cy={s.y}
              r={active ? m.hqRadius.active : m.hqRadius.normal}
              fill={active ? "rgba(251,191,36,0.35)" : "rgba(255,255,255,0.12)"}
              stroke={active ? "#fbbf24" : "rgba(255,255,255,0.45)"}
              strokeWidth={m.hqStroke}
            />
            <text
              x={s.x}
              y={s.y - m.hqLabelOffset}
              textAnchor="middle"
              fill="#fbbf24"
              fontSize={m.hqLabelSize}
              fontWeight="600"
            >
              HQ {index + 1}
            </text>
          </g>
        );
      })}

      {routes.map((route) => {
        const pts = polylinePoints(route.points, imgW, imgH);
        if (!pts) return null;
        const highlighted =
          route.id === hoveredRouteId || route.id === selectedRouteId;
        const isSelected = route.id === selectedRouteId;
        const hitWidth = Math.max(m.routeStroke.highlighted * 4, m.routeHitWidth);

        return (
          <g key={route.id}>
            {isSelected && onRoutePathClick && (
              <polyline
                points={pts}
                fill="none"
                stroke="transparent"
                strokeWidth={hitWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  const pt = kernel.screenToMapPercent(e.clientX, e.clientY);
                  if (pt) onRoutePathClick(route.id, pt);
                }}
              />
            )}
            <polyline
              points={pts}
              fill="none"
              stroke={route.color}
              strokeWidth={highlighted ? m.routeStroke.highlighted : m.routeStroke.normal}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={1}
              style={{ pointerEvents: "none" }}
            />
            {route.points.length >= 1 && (
              <RouteVehicleMarker
                route={route}
                factionId={factionId}
                imgW={imgW}
                imgH={imgH}
                start={route.points[0]}
                next={route.points[1]}
              />
            )}
          </g>
        );
      })}

      {pendingEnd && (
        <circle
          cx={mapPctToPx(pendingEnd.x, pendingEnd.y, imgW, imgH).x}
          cy={mapPctToPx(pendingEnd.x, pendingEnd.y, imgW, imgH).y}
          r={m.pendingRadius}
          fill="rgba(255,255,255,0.2)"
          stroke="#fff"
          strokeWidth={m.pendingStroke}
          strokeDasharray="4 3"
        />
      )}

      {visibleWaypoints.map((wp) => {
        const isSelected =
          selectedWaypoint?.routeId === selectedRouteId &&
          selectedWaypoint?.index === wp.index;
        const isDragging =
          dragPreview?.routeId === selectedRouteId &&
          dragPreview?.index === wp.index;
        const display = isDragging ? dragPreview : wp;
        const pos = mapPctToPx(display.x, display.y, imgW, imgH);

        let fill = wp.kind === "end" ? "#fff" : "#c4b5fd";
        let stroke = "#fbbf24";
        if (isDragging) {
          fill = "#f97316";
          stroke = "#fff";
        } else if (isSelected) {
          fill = "#38bdf8";
          stroke = "#fff";
        }

        return (
          <WaypointHandle
            key={`waypoint-${selectedRouteId}-${wp.index}`}
            pos={pos}
            kind={wp.kind}
            metrics={m}
            state={{
              fill,
              stroke,
              scale: isDragging || isSelected ? 1.15 : 1,
              cursor: isDragging ? "grabbing" : isSelected ? "grab" : "pointer",
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onWaypointPointerDown?.(selectedRouteId, wp.index, e);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onWaypointContextMenu?.(selectedRouteId, wp.index, e);
            }}
          />
        );
      })}
    </svg>,
    stage
  );
}
