import { Link, useParams } from "react-router-dom";
import { Button } from "../../shared/Button.jsx";
import { Spinner } from "../../shared/Spinner.jsx";
import {
  FACTION_LABELS,
  RESULT_LABELS,
  canEditEvents,
  formatEventMatchSummary,
  isMatchEventType,
} from "../calendar/calendar-utils.js";
import { compTeamLabel } from "../../../functions/lib/comp-teams.js";
import { useEventQuery, useCloseRsvpMutation } from "../calendar/hooks/useEventsQuery.js";
import { useAuth } from "../auth/AuthGate.jsx";
import { canManageTeam } from "../../lib/roles.js";
import { getStartingPointLabel } from "../../shared/mapMidpoints.js";
import { EventScheduleIndicators } from "../calendar/EventScheduleIndicators.jsx";
import { EventComponentsPanel } from "./EventComponentsPanel.jsx";
import { EventLockBadge } from "./EventLockBadge.jsx";
import { isEventEffectivelyLocked } from "./event-lock.js";
import { PrepTasksPanel } from "./PrepTasksPanel.jsx";
import { RsvpBar } from "./RsvpBar.jsx";
import { useEventRsvpsQuery } from "./hooks/useRsvpsQuery.js";
import { eventTypeLabel, formatEventSchedule } from "./event-brief-utils.js";
import { eventHasParticipant } from "../records/match-history-utils.js";

function linkifyText(text) {
  const parts = String(text || "").split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, index) => {
    if (/^https?:\/\//i.test(part)) {
      return (
        <a
          key={`link-${index}`}
          className="break-all text-accent underline-offset-2 hover:underline"
          href={part}
          target="_blank"
          rel="noreferrer"
        >
          {part}
        </a>
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
}

function MatchFacts({ event }) {
  const match = event?.match;
  const summary = formatEventMatchSummary(event);
  if (!isMatchEventType(event?.eventType) && !summary) {
    return null;
  }

  const rows = [
    { label: "Team", value: compTeamLabel(match?.team) },
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
      {match?.heloUrl || match?.crconUrl ? (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-3 text-[0.85rem]">
          {match.heloUrl ? (
            <a
              className="text-accent underline-offset-2 hover:underline"
              href={match.heloUrl}
              target="_blank"
              rel="noreferrer"
            >
              HeLO match{match.heloMatchId ? ` (${match.heloMatchId})` : ""}
            </a>
          ) : null}
          {match.crconUrl ? (
            <a
              className="text-accent underline-offset-2 hover:underline"
              href={match.crconUrl}
              target="_blank"
              rel="noreferrer"
              title="May show Cloudflare 403 until the stats site challenge passes"
            >
              CRCON scoreboard{match.crconGameId ? ` (#${match.crconGameId})` : ""}
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function MatchBriefPage() {
  const { eventId } = useParams();
  const user = useAuth();
  const canEdit = canEditEvents(user?.role);
  const canAttachRoster = canManageTeam(user?.role);
  const eventQuery = useEventQuery(eventId);
  const closeRsvp = useCloseRsvpMutation();
  const rsvpQuery = useEventRsvpsQuery(eventId);

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

  const eventLocked = isEventEffectivelyLocked(event);
  const canEditEvent = canEdit && !eventLocked;
  const rsvpClosed = Boolean(rsvpQuery.data?.rsvpClosed || event.rsvpClosed);
  const canCloseRsvp = canEdit && !rsvpClosed;
  const youPlayed = eventHasParticipant(event, user?.steamId);

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
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <EventLockBadge event={event} />
              <EventScheduleIndicators components={event.components} />
              {youPlayed ? (
                <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-sky-100">
                  You played
                </span>
              ) : null}
            </div>
          </div>
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[0.72rem] uppercase tracking-[0.12em] text-emerald-200">
            {eventTypeLabel(event.eventType)}
          </span>
        </div>
      </header>

      {youPlayed ? (
        <p className="m-0 rounded-2xl border border-sky-400/25 bg-sky-400/10 px-4 py-3 text-[0.85rem] text-sky-50/90">
          Your Steam ID was on Circle’s side for this match (HeLO/CRCON scoreboard link).
        </p>
      ) : null}
      {event.description ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h2 className="m-0 mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-white/45">Notes</h2>
          <p className="m-0 whitespace-pre-wrap text-[0.9rem] leading-relaxed text-white/75">
            {linkifyText(event.description)}
          </p>
        </section>
      ) : null}

      {eventLocked ? (
        <p className="m-0 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-[0.85rem] text-amber-50/90">
          This event is locked. Linked tools and prep tasks cannot be changed.
        </p>
      ) : null}

      <MatchFacts event={event} />

      {canCloseRsvp ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="m-0 text-[0.82rem] text-white/55">
            RSVP is open. Close it when signups are final — confirmed players can then raincheck only.
          </p>
          <Button
            type="button"
            variant="ghost"
            disabled={closeRsvp.isPending}
            onClick={() => closeRsvp.mutate(event.id)}
          >
            {closeRsvp.isPending ? "Closing…" : "Close RSVP"}
          </Button>
        </div>
      ) : rsvpClosed ? (
        <p className="m-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[0.82rem] text-white/55">
          RSVP is closed for this event.
        </p>
      ) : null}

      <RsvpBar eventId={event.id} event={event} />

      <PrepTasksPanel eventId={event.id} canEdit={canEditEvent} eventLocked={eventLocked} />

      <section>
        <h2 className="m-0 mb-3 text-[0.72rem] uppercase tracking-[0.16em] text-white/45">
          Linked tools
        </h2>
        <EventComponentsPanel
          eventId={event.id}
          components={event.components}
          canEdit={canEditEvent}
          canAttachRoster={canAttachRoster && !eventLocked}
          canAttachLineup={canAttachRoster && !eventLocked}
          eventLocked={eventLocked}
        />
      </section>
    </div>
  );
}
