import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getRouteFactionId } from "./constants.js";
import { getHqSideFromData } from "./timing/frontier-wall.js";
import {
  computeRouteTimeline,
  positionAtMatchTime,
} from "./timing/route-timing.js";
import {
  getRouteVehicleIconSrc,
  getRouteVehicleSizePct,
  getRouteVehicleSpeedKmh,
  routeStartIconRotationDeg,
} from "./route-vehicles.js";

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

function headingFromTimeline(timeline, matchTimeSec) {
  if (!timeline || timeline.length < 2) return 0;
  for (let i = 1; i < timeline.length; i++) {
    if (timeline[i].t >= matchTimeSec) {
      return routeStartIconRotationDeg(timeline[i - 1], timeline[i]);
    }
  }
  const a = timeline[timeline.length - 2];
  const b = timeline[timeline.length - 1];
  return routeStartIconRotationDeg(a, b);
}

function PlaybackVehicleIcon({ route, factionId, pos, imgW, imgH, timeline, matchTimeSec }) {
  const src = getRouteVehicleIconSrc(route.vehicleId, factionId);
  if (!src || !pos) return null;

  const { w: sizeWPct, h: sizeHPct } = getRouteVehicleSizePct(route.vehicleId, factionId);
  const widthPx = Math.max(10, (sizeWPct / 100) * imgW);
  const heightPx = Math.max(10, (sizeHPct / 100) * imgH);
  const cx = (pos.x / 100) * imgW;
  const cy = (pos.y / 100) * imgH;
  const rotation = headingFromTimeline(timeline, matchTimeSec);

  return (
    <g transform={`translate(${cx}, ${cy}) rotate(${rotation})`}>
      <circle r={Math.max(widthPx, heightPx) * 0.55} fill="rgba(0,0,0,0.45)" />
      <image
        href={src}
        x={-widthPx / 2}
        y={-heightPx / 2}
        width={widthPx}
        height={heightPx}
        preserveAspectRatio="xMidYMid meet"
      />
    </g>
  );
}

export function RoutePlaybackOverlay({
  kernelRef,
  kernelReady = false,
  routes,
  planFactionId,
  hqData,
  mapId,
  matchTimeSec = 0,
  active = false,
}) {
  const { imgW, imgH } = useMapImageSize(kernelRef, kernelReady);

  const timelines = useMemo(() => {
    if (!active || !routes?.length) return [];
    return routes
      .filter((r) => r.points?.length >= 2)
      .map((route) => {
        const faction = getRouteFactionId(route, planFactionId);
        const hqSide = getHqSideFromData(hqData, mapId, faction);
        const speed = getRouteVehicleSpeedKmh(route.vehicleId, faction);
        return {
          route,
          faction,
          timeline: computeRouteTimeline(route.points, speed, hqSide),
        };
      });
  }, [active, routes, planFactionId, hqData, mapId]);

  if (!active || !kernelReady || !imgW || !imgH || !timelines.length) return null;

  const kernel = kernelRef.current;
  const stage = kernel?.getStage();
  if (!kernel || !stage) return null;

  return createPortal(
    <svg
      className="routeplanner-playback"
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
        zIndex: 8,
      }}
    >
      {timelines.map(({ route, faction, timeline }) => {
        const pos = positionAtMatchTime(timeline, matchTimeSec);
        if (!pos) return null;
        return (
          <PlaybackVehicleIcon
            key={`playback-${route.id}`}
            route={route}
            factionId={faction}
            pos={pos}
            imgW={imgW}
            imgH={imgH}
            timeline={timeline}
            matchTimeSec={matchTimeSec}
          />
        );
      })}
    </svg>,
    stage
  );
}
