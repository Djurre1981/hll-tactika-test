export const MIDPOINT_NA_ID = "na";
export const MIDPOINT_NA_OPTION = { id: MIDPOINT_NA_ID, label: "N/A" };

let midpointsByMap = null;

export async function loadMapMidpoints() {
  if (midpointsByMap) {
    return midpointsByMap;
  }

  const response = await fetch("data/map-midpoints.json");
  if (!response.ok) {
    throw new Error("Failed to load map midpoints");
  }

  midpointsByMap = await response.json();
  return midpointsByMap;
}

export function getMidpointsForMap(mapId) {
  const mapMidpoints = midpointsByMap?.[mapId] || [];
  return [...mapMidpoints, MIDPOINT_NA_OPTION];
}

export function getStartingPointLabel(mapId, startingPointId) {
  if (startingPointId === MIDPOINT_NA_ID) {
    return MIDPOINT_NA_OPTION.label;
  }

  const midpoint = midpointsByMap?.[mapId]?.find((entry) => entry.id === startingPointId);
  return midpoint?.label || startingPointId || "";
}

export function isValidStartingPoint(mapId, startingPointId) {
  if (!startingPointId) {
    return true;
  }
  if (startingPointId === MIDPOINT_NA_ID) {
    return true;
  }
  return Boolean(midpointsByMap?.[mapId]?.some((entry) => entry.id === startingPointId));
}
