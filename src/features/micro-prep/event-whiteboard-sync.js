export {
  formatStratEventOption as formatWhiteboardEventOption,
  isUpcomingEvent,
} from "../strats/editor/event-strat-sync.js";

export function findLinkedEventIdForWhiteboard(events, whiteboardId) {
  if (!whiteboardId || !Array.isArray(events)) return "";
  const hit = events.find((event) => event.components?.whiteboardIds?.includes(whiteboardId));
  return hit?.id || "";
}

export function whiteboardEventSummary(event) {
  if (!event) return "None";
  const when = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.startsAt));
  return `${event.title} · ${when} · ${event.eventType}`;
}
