import { getHllObjectDef } from "@map-kernel/icons/hll-object-catalog.js";
import { getVehicleEntry, vehiclesCatalog } from "./timing/vehicle-speeds.js";

/**
 * Curated route vehicles per faction — maps game vehicle id → HLL stratmaker icon + speed.
 * One canonical variant per role (not every skin).
 */
export const ROUTE_VEHICLE_OPTIONS = [
  {
    id: "ford-base-transport",
    factionId: "us",
    hllId: "truck-transport",
    label: "Transport Truck",
    role: "transport",
  },
  {
    id: "ford-base-supply",
    factionId: "us",
    hllId: "truck-supply",
    label: "Supply Truck",
    role: "supply",
  },
  {
    id: "jeep-us",
    factionId: "us",
    hllId: "jeep",
    label: "Jeep",
    role: "jeep",
  },
  {
    id: "halftrack-us",
    factionId: "us",
    hllId: "halftrack",
    label: "Halftrack",
    role: "halftrack",
  },
  {
    id: "opel-blitz-transport",
    factionId: "ger",
    hllId: "truck-transport",
    label: "Transport Truck",
    role: "transport",
  },
  {
    id: "opel-blitz-supply",
    factionId: "ger",
    hllId: "truck-supply",
    label: "Supply Truck",
    role: "supply",
  },
  {
    id: "kubelwagen",
    factionId: "ger",
    hllId: "jeep",
    label: "Kübelwagen",
    role: "jeep",
  },
  {
    id: "halftrack-ger",
    factionId: "ger",
    hllId: "halftrack",
    label: "Halftrack",
    role: "halftrack",
  },
];

const byId = Object.fromEntries(ROUTE_VEHICLE_OPTIONS.map((o) => [o.id, o]));

/** Legacy plans without vehicleId — maps to faction default transport. */
const LEGACY_TRANSPORT_ALIASES = {
  "transport-truck": "ford-base-transport",
};

export function getRouteVehicleOptions(factionId) {
  return ROUTE_VEHICLE_OPTIONS.filter((o) => o.factionId === factionId);
}

export function getDefaultRouteVehicleId(factionId) {
  return (
    getRouteVehicleOptions(factionId).find((o) => o.role === "transport")?.id ||
    ROUTE_VEHICLE_OPTIONS[0].id
  );
}

export function resolveRouteVehicleOption(vehicleId, factionId) {
  const normalized = LEGACY_TRANSPORT_ALIASES[vehicleId] || vehicleId;
  const direct = byId[normalized];
  if (direct && direct.factionId === factionId) return direct;
  const fallback = getRouteVehicleOptions(factionId).find((o) => o.id === normalized);
  if (fallback) return fallback;
  const defaultId = getDefaultRouteVehicleId(factionId);
  return byId[defaultId] || ROUTE_VEHICLE_OPTIONS[0];
}

export function normalizeRouteVehicleId(vehicleId, factionId) {
  return resolveRouteVehicleOption(vehicleId, factionId).id;
}

export function getRouteVehicleHllId(vehicleId, factionId) {
  return resolveRouteVehicleOption(vehicleId, factionId).hllId;
}

export function getRouteVehicleLabel(vehicleId, factionId) {
  return resolveRouteVehicleOption(vehicleId, factionId).label;
}

export function getRouteVehicleSpeedKmh(vehicleId, factionId) {
  const option = resolveRouteVehicleOption(vehicleId, factionId);
  const entry = getVehicleEntry(option.id);
  const speed = entry?.maxSpeedKmh;
  if (typeof speed === "number" && speed > 0) return speed;
  const fallback = getVehicleEntry(vehiclesCatalog.defaultVehicleId);
  return fallback?.maxSpeedKmh || 38;
}

export function getRouteVehicleIconSrc(vehicleId, factionId) {
  const hllId = getRouteVehicleHllId(vehicleId, factionId);
  const def = getHllObjectDef(hllId);
  return def?.plainSrc || def?.src || null;
}

export function getRouteVehicleSizePct(vehicleId, factionId) {
  const hllId = getRouteVehicleHllId(vehicleId, factionId);
  const def = getHllObjectDef(hllId);
  if (!def) return { w: 1.3, h: 1.3 };
  return {
    w: def.plainSizePct ?? def.sizePct ?? 1.3,
    h: def.plainSizeHPct ?? def.plainSizePct ?? def.sizePct ?? 1.3,
  };
}

/** HLL vehicle art points up; rotate so the top aligns with travel direction. */
export function routeStartIconRotationDeg(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.hypot(dx, dy) < 1e-6) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI + 90;
}
