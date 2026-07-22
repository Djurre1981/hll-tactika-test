import { RouteOverlay } from "../../routeplanner/RouteOverlay.jsx";

/**
 * Read-only route plan overlay for Stratmaker slides.
 */
export function StratRouteOverlay({
  kernelRef,
  kernelReady = false,
  routePlan,
}) {
  if (!kernelReady || !routePlan) return null;

  const inner =
    routePlan.plan && typeof routePlan.plan === "object" ? routePlan.plan : routePlan;
  const routes = inner.routes || [];
  if (!routes.length) return null;

  const planFaction = inner.factionId || "us";

  return (
    <RouteOverlay
      kernelRef={kernelRef}
      kernelReady={kernelReady}
      routes={routes}
      factionId={planFaction}
      hqSpawns={[]}
      selectedHqIndex={inner.hqIndex ?? 0}
      hoveredRouteId={null}
      selectedRouteId={null}
      selectedWaypoint={null}
      dragPreview={null}
      hideVehicleMarkers={false}
    />
  );
}
