import { canEditEvents } from "../../lib/roles.js";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export { canEditEvents };

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

export function localDateTimeValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function buildMonthDays(monthDate) {
  const first = startOfMonth(monthDate);
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

export function eventsForDay(events, day) {
  return events.filter((event) => sameDay(new Date(event.startsAt), day));
}

const MATCH_EVENT_TYPES = new Set(["scrim", "comp"]);

export function isMatchEventType(eventType) {
  return MATCH_EVENT_TYPES.has(String(eventType || "").trim());
}

const FACTION_LABELS = {
  axis: "Axis",
  allies: "Allies",
};

const RESULT_LABELS = {
  win: "Win",
  loss: "Loss",
};

const STARTING_POINT_LABELS = {
  "00": "HQ north",
  "01": "HQ mid",
  "02": "HQ south",
  na: "N/A",
};

/** One-line match summary for calendar lists (empty string when no match facts). */
export function formatEventMatchSummary(event) {
  const match = event?.match;
  if (!match || typeof match !== "object") return "";

  const parts = [];
  if (match.opponent) parts.push(`vs ${match.opponent}`);
  if (match.mapId) parts.push(match.mapId);
  if (match.faction) parts.push(FACTION_LABELS[match.faction] || match.faction);
  if (match.startingPoint) {
    parts.push(STARTING_POINT_LABELS[match.startingPoint] || match.startingPoint);
  }
  if (match.result) parts.push(RESULT_LABELS[match.result] || match.result);
  return parts.join(" · ");
}

export { FACTION_LABELS, RESULT_LABELS, STARTING_POINT_LABELS };
