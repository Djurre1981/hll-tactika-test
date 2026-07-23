/** Map calendar event type → strat tag type. */
export function eventTypeToStratType(eventType) {
  return eventType === "comp" ? "tournament" : "friendly";
}

function localDateFromIso(iso) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Build a one-time strat patch from a linked calendar event.
 * Team (JR/SR) is not on events — existing strat team is preserved via partial merge.
 */
export function eventPropertiesToStratPatch(event) {
  if (!event) return {};

  const eventMatch = event.match && typeof event.match === "object" ? event.match : {};
  const date = eventMatch.date || localDateFromIso(event.startsAt);

  const patch = {
    tags: {
      type: eventTypeToStratType(event.eventType),
    },
    match: {
      date,
      faction: eventMatch.faction || "",
      mapId: eventMatch.mapId || "",
      startingPoint: eventMatch.startingPoint || "",
      opponent: eventMatch.opponent || "",
      result: eventMatch.result || "",
    },
  };

  const description = String(event.description || "").trim();
  if (description) {
    patch.notes = description;
  }

  return patch;
}

export function formatStratEventOption(event) {
  const when = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.startsAt));
  return `${event.title} · ${when} · ${event.eventType}`;
}

export function isUpcomingEvent(event, now = new Date()) {
  if (!event?.startsAt) return false;
  const start = new Date(event.startsAt);
  if (Number.isNaN(start.getTime())) return false;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return start >= startOfToday;
}

export function findLinkedEventId(events, stratId) {
  if (!stratId || !Array.isArray(events)) return "";
  const hit = events.find((event) => event.components?.stratIds?.includes(stratId));
  return hit?.id || "";
}

export function stratEventSummary(event) {
  if (!event) return "None";
  return formatStratEventOption(event);
}
