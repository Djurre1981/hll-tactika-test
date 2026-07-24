import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EventLockBadge } from "../events/EventLockBadge.jsx";
import { RaincheckFlow } from "../events/RaincheckFlow.jsx";
import { RsvpCountStrip } from "../events/RsvpCountStrip.jsx";
import { useEventsRsvpsQuery } from "../events/hooks/useEventsRsvpsQuery.js";
import { useEventsRangeQuery } from "./hooks/useEventsQuery.js";
import {
  filterUpcomingEvents,
  formatEventMatchSummary,
  formatEventStartsAt,
  UPCOMING_PERIODS,
} from "./calendar-utils.js";
import { EventScheduleIndicators } from "./EventScheduleIndicators.jsx";

const TYPE_LABELS = {
  scrim: "Scrim",
  comp: "Comp",
  practice: "Practice",
  other: "Other",
};

function PeriodSelector({ value, onChange }) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-black/20 p-0.5"
      role="group"
      aria-label="Upcoming period"
    >
      {UPCOMING_PERIODS.map((period) => {
        const active = value === period.id;
        return (
          <button
            key={period.id}
            type="button"
            title={period.label}
            className={[
              "rounded-full px-2.5 py-1 text-[0.68rem] transition",
              active
                ? "bg-white/15 text-white"
                : "text-white/45 hover:bg-white/[0.06] hover:text-white/75",
            ].join(" ")}
            aria-pressed={active}
            onClick={() => onChange?.(period.id)}
          >
            {period.shortLabel}
          </button>
        );
      })}
    </div>
  );
}

export function DayDetails({
  selectedDay,
  canEdit,
  onAdd,
  onEditEvent,
}) {
  const [period, setPeriod] = useState("7d");
  const [raincheckEventId, setRaincheckEventId] = useState(null);

  const periodDays = UPCOMING_PERIODS.find((p) => p.id === period)?.days || 7;
  const range = useMemo(() => {
    const now = new Date();
    const toDate = new Date(now);
    toDate.setUTCDate(toDate.getUTCDate() + periodDays);
    return { from: now.toISOString(), to: toDate.toISOString() };
  }, [periodDays]);

  const upcomingQuery = useEventsRangeQuery({ from: range.from, to: range.to });
  const upcomingEvents = useMemo(
    () => filterUpcomingEvents(upcomingQuery.data?.events || [], { days: periodDays }),
    [upcomingQuery.data, periodDays],
  );
  const eventIds = useMemo(
    () => upcomingEvents.map((e) => e.id).filter(Boolean),
    [upcomingEvents],
  );
  const eventRsvps = useEventsRsvpsQuery(eventIds);
  const periodLabel = UPCOMING_PERIODS.find((p) => p.id === period)?.label || "Period";

  return (
    <aside className="flex min-h-0 flex-col overflow-auto rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[0.68rem] uppercase tracking-[0.16em] text-white/40">
            Upcoming events
          </p>
          <h2 className="mt-1.5 text-[1.15rem] font-medium text-white">{periodLabel}</h2>
          <div className="mt-3">
            <PeriodSelector value={period} onChange={setPeriod} />
          </div>
        </div>
        {canEdit ? (
          <button
            type="button"
            className="min-h-[2.1rem] shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[0.78rem] tracking-wide text-white/90 transition hover:bg-white/10"
            onClick={() => onAdd(selectedDay)}
          >
            + Add
          </button>
        ) : null}
      </header>

      {upcomingQuery.isLoading ? (
        <p className="mt-6 text-[0.9rem] text-white/40">Loading…</p>
      ) : upcomingEvents.length === 0 ? (
        <p className="mt-6 text-[0.9rem] text-white/40">No upcoming events in this period.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {upcomingEvents.map((event) => {
            const matchSummary = formatEventMatchSummary(event);
            const payload = eventRsvps.payloads.get(event.id);
            const rsvpCounts = payload?.uiCounts || eventRsvps.counts.get(event.id) || null;
            const canRaincheck =
              payload?.rsvpClosed && payload?.mine?.status === "confirmed";
            return (
              <li key={event.id}>
                <div className="grid grid-cols-[1fr_auto] items-start gap-2 rounded-2xl border border-white/[0.08] bg-black/20 px-3.5 py-3.5 transition hover:border-white/15 hover:bg-white/[0.06]">
                  <Link
                    to={`/events/${event.id}`}
                    className="grid min-w-0 grid-cols-[auto_1fr] items-start gap-3 no-underline"
                  >
                    <span className="max-w-[5.5rem] whitespace-normal text-[0.78rem] font-medium leading-snug text-white">
                      {formatEventStartsAt(event.startsAt)}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[0.9rem] text-white/90">{event.title}</span>
                      {matchSummary ? (
                        <span className="truncate text-[0.78rem] text-sky-200/80">{matchSummary}</span>
                      ) : null}
                      {event.description ? (
                        <span className="truncate text-[0.78rem] text-white/40">
                          {event.description}
                        </span>
                      ) : null}
                      <EventScheduleIndicators
                        components={event.components}
                        className="mt-1"
                        compact
                      />
                      <RsvpCountStrip counts={rsvpCounts} compact className="mt-1" />
                    </span>
                  </Link>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[0.68rem] capitalize tracking-wide text-emerald-200">
                        {TYPE_LABELS[event.eventType] || event.eventType}
                      </span>
                      <EventLockBadge event={event} />
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      {canRaincheck ? (
                        <button
                          type="button"
                          className="rounded-full border border-white/10 px-2 py-0.5 text-[0.64rem] uppercase tracking-[0.08em] text-white/45 transition hover:border-red-400/35 hover:text-red-100"
                          onClick={() => setRaincheckEventId(event.id)}
                        >
                          Raincheck
                        </button>
                      ) : null}
                      {canEdit ? (
                        <button
                          type="button"
                          title="Edit event settings"
                          aria-label={`Edit ${event.title}`}
                          className="rounded-full border border-white/10 px-2 py-0.5 text-[0.64rem] uppercase tracking-[0.08em] text-white/45 transition hover:border-accent/35 hover:text-accent"
                          onClick={() => onEditEvent?.(event)}
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <RaincheckFlow
        open={Boolean(raincheckEventId)}
        onClose={() => setRaincheckEventId(null)}
        initialEventId={raincheckEventId}
      />
    </aside>
  );
}
