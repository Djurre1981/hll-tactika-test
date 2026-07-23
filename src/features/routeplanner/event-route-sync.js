import { eventSlideMapId } from "../strats/editor/event-strat-sync.js";
import { STRAT_MAP_IDS } from "../strats/editor/mapIds.js";

export {
  formatStratEventOption as formatRoutePlanEventOption,
  isUpcomingEvent,
} from "../strats/editor/event-strat-sync.js";

/** Map event match faction (axis/allies) → route planner faction id (ger/us). */
export function eventMatchFactionToRouteFaction(faction) {
  if (faction === "axis") return "ger";
  if (faction === "allies") return "us";
  return "";
}

/** Build a one-time route plan patch from a linked calendar event. */
export function eventPropertiesToRoutePlanPatch(event) {
  if (!event) return {};

  const eventMatch = event.match && typeof event.match === "object" ? event.match : {};
  const patch = {};

  const mapId = eventSlideMapId(event, STRAT_MAP_IDS);
  if (mapId) patch.mapId = mapId;

  const factionId = eventMatchFactionToRouteFaction(eventMatch.faction);
  if (factionId) patch.factionId = factionId;

  return patch;
}

export function findLinkedEventIdForRoutePlan(events, planId) {
  if (!planId || !Array.isArray(events)) return "";
  const hit = events.find((event) => event.components?.routePlanIds?.includes(planId));
  return hit?.id || "";
}

export function routePlanEventSummary(event) {
  if (!event) return "None";
  const when = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.startsAt));
  return `${event.title} · ${when} · ${event.eventType}`;
}
