import midpointsByMap from "../../public/data/map-midpoints.json" with { type: "json" };

export const MIDPOINT_NA_ID = "na";
export const MIDPOINT_NA_OPTION = { id: MIDPOINT_NA_ID, label: "N/A" };

/** Middle strongpoint options for a map (the three mid sectors, not HQ vehicle spawns). */
export function getMidpointsForMap(mapId) {
  const mapMidpoints = midpointsByMap?.[mapId] || [];
  return [...mapMidpoints, MIDPOINT_NA_OPTION];
}

export function getStartingPointLabel(mapId, startingPointId) {
  if (!startingPointId) return "";
  if (startingPointId === MIDPOINT_NA_ID) return MIDPOINT_NA_OPTION.label;

  const midpoint = midpointsByMap?.[mapId]?.find((entry) => entry.id === startingPointId);
  return midpoint?.label || startingPointId;
}

export function isValidStartingPoint(mapId, startingPointId) {
  if (!startingPointId) return true;
  if (startingPointId === MIDPOINT_NA_ID) return true;
  return Boolean(midpointsByMap?.[mapId]?.some((entry) => entry.id === startingPointId));
}
