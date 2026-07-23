import { Link, useParams } from "react-router-dom";
import { Spinner } from "../../shared/Spinner.jsx";
import {
  FACTION_LABELS,
  RESULT_LABELS,
  canEditEvents,
  formatEventMatchSummary,
  isMatchEventType,
} from "../calendar/calendar-utils.js";
import { useEventQuery } from "../calendar/hooks/useEventsQuery.js";
import { useAuth } from "../auth/AuthGate.jsx";
import { canManageTeam } from "../../lib/roles.js";
import { getStartingPointLabel } from "../../shared/mapMidpoints.js";
import { EventScheduleIndicators } from "../calendar/EventScheduleIndicators.jsx";
import { EventComponentsPanel } from "./EventComponentsPanel.jsx";
import { PrepTasksPanel } from "./PrepTasksPanel.jsx";
import { eventTypeLabel, formatEventSchedule } from "./event-brief-utils.js";

function MatchFacts({ event }) {
  const match = event?.match;
  const summary = formatEventMatchSummary(event);
  if (!isMatchEventType(event?.eventType) && !summary) {
    return null;
  }

  const rows = [
    match?.opponent ? { label: "Opponent", value: match.opponent } : null,
    match?.mapId ? { label: "Map", value: match.mapId } : null,
    match?.faction
      ? { label: "Faction", value: FACTION_LABELS[match.faction] || match.faction }
      : null,
    match?.startingPoint
      ? {
          label: "Starting strongpoint",
          value: getStartingPointLabel(match.mapId, match.startingPoint) || match.startingPoint,
        }
      : null,
    match?.result
      ? { label: "Result", value: RESULT_LABELS[match.result] || match.result }
      : null,
  ].filter(Boolean);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h2 className="m-0 mb-3 text-[0.72rem] uppercase tracking-[0.16em] text-white/45">
        Match details
      </h2>
      {rows.length ? (
        <dl className="m-0 grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-[0.68rem] uppercase tracking-[0.12em] text-white/40">
                {row.label}
              </dt>
              <dd className="m-0 mt-0.5 text-[0.92rem] text-white/90">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="m-0 text-[0.85rem] text-white/45">
          No match details set yet. Edit the event on the calendar to add opponent, map, and side.
        </p>
      )}
    </section>
  );
}

export function MatchBriefPage() {
  const { eventId } = useParams();
  const user = useAuth();
  const canEdit = canEditEvents(user?.role);
  const canAttachRoster = canManageTeam(user?.role);
  const eventQuery = useEventQuery(eventId);

  if (eventQuery.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center gap-3 text-white/55">
        <Spinner />
        <span>Loading match brief…</span>
      </div>
    );
  }

  if (eventQuery.error) {
    return (
      <section className="space-y-4">
        <Link to="/calendar" className="text-[0.82rem] text-white/50 no-underline hover:text-white/80">
          ← Calendar
        </Link>
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          {eventQuery.error.message || "Could not load this event."}
        </p>
      </section>
    );
  }

  const event = eventQuery.data;
  if (!event) {
    return (
      <section className="space-y-4">
        <Link to="/calendar" className="text-[0.82rem] text-white/50 no-underline hover:text-white/80">
          ← Calendar
        </Link>
        <p className="text-white/50">Event not found.</p>
      </section>
    );
  }

  return (
    <div className="glass-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
      <header className="space-y-3">
        <Link
          to="/calendar"
          className="inline-block text-[0.82rem] text-white/50 no-underline transition hover:text-white/80"
        >
          ← Calendar
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 text-[0.68rem] uppercase tracking-[0.18em] text-accent">Match Brief</p>
            <h1 className="m-0 mt-1.5 text-[clamp(1.45rem,2.4vw,2rem)] font-medium tracking-wide text-white">
              {event.title}
            </h1>
            <p className="m-0 mt-2 text-[0.88rem] text-white/55">{formatEventSchedule(event)}</p>
            <EventScheduleIndicators components={event.components} className="mt-2.5" />
          </div>
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[0.72rem] uppercase tracking-[0.12em] text-emerald-200">
            {eventTypeLabel(event.eventType)}
          </span>
        </div>
      </header>

      {event.description ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h2 className="m-0 mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-white/45">Notes</h2>
          <p className="m-0 whitespace-pre-wrap text-[0.9rem] leading-relaxed text-white/75">
            {event.description}
          </p>
        </section>
      ) : null}

      <MatchFacts event={event} />

      <PrepTasksPanel eventId={event.id} canEdit={canEdit} />

      <section>
        <h2 className="m-0 mb-3 text-[0.72rem] uppercase tracking-[0.16em] text-white/45">
          Linked tools
        </h2>
        <EventComponentsPanel
          eventId={event.id}
          components={event.components}
          canEdit={canEdit}
          canAttachRoster={canAttachRoster}
        />
      </section>
    </div>
  );
}
