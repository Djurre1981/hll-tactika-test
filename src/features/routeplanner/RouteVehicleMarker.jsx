import {
  getRouteVehicleIconSrc,
  getRouteVehicleSizePct,
  routeStartIconRotationDeg,
} from "./route-vehicles.js";

export function RouteVehicleMarker({ route, factionId, imgW, imgH, start, next }) {
  const src = getRouteVehicleIconSrc(route.vehicleId, factionId);
  if (!src || !start) return null;

  const { w: sizeWPct, h: sizeHPct } = getRouteVehicleSizePct(route.vehicleId, factionId);
  const widthPx = Math.max(8, (sizeWPct / 100) * imgW);
  const heightPx = Math.max(8, (sizeHPct / 100) * imgH);
  const cx = (start.x / 100) * imgW;
  const cy = (start.y / 100) * imgH;
  const rotation = next ? routeStartIconRotationDeg(start, next) : 0;

  return (
    <g
      transform={`translate(${cx}, ${cy}) rotate(${rotation})`}
      style={{ pointerEvents: "none" }}
      aria-hidden="true"
    >
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
