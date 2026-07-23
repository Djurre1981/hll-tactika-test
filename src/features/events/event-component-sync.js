import { apiClient } from "../../lib/api-client.js";

export function normalizeRoutePlanRecord(raw) {
  if (!raw) return null;
  const inner = raw.plan && typeof raw.plan === "object" ? raw.plan : {};
  return {
    id: raw.id,
    title: raw.title || "Untitled route plan",
    inner,
  };
}

/** Build PUT body for syncing routePlan.eventId (matches RouteplannerPage save shape). */
export function buildRoutePlanEventIdPutBody(record, eventId) {
  if (!record) return null;
  const inner = record.inner;
  return {
    plan: {
      title: record.title,
      plan: {
        mapId: inner.mapId || "Carentan",
        factionId: inner.factionId || "us",
        hqIndex: inner.hqIndex ?? 0,
        eventId: eventId ?? null,
        routes: Array.isArray(inner.routes) ? inner.routes : [],
        obstacles: Array.isArray(inner.obstacles) ? inner.obstacles : [],
        obstacleVectorBuildId: inner.obstacleVectorBuildId ?? null,
      },
    },
  };
}

/** Keep reverse routePlan.eventId aligned with Match Brief attach/detach. */
export async function syncRoutePlanEventLink(planId, eventId) {
  if (!planId) return;

  const data = await apiClient(`/route-plans/${planId}`);
  const record = normalizeRoutePlanRecord(data.plan);
  const body = buildRoutePlanEventIdPutBody(record, eventId);
  if (!body) return;

  await apiClient(`/route-plans/${planId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** Map brief UI kind → components API type string. */
export const COMPONENT_API_TYPES = {
  strat: "strat",
  routePlan: "routePlan",
  whiteboard: "whiteboard",
  roster: "roster",
};

export function linkedIdsForKind(components, kind) {
  const normalized = components || {};
  if (kind === "roster") {
    return normalized.rosterId ? [normalized.rosterId] : [];
  }
  const key =
    kind === "strat"
      ? "stratIds"
      : kind === "routePlan"
        ? "routePlanIds"
        : kind === "whiteboard"
          ? "whiteboardIds"
          : null;
  return key && Array.isArray(normalized[key]) ? normalized[key] : [];
}
