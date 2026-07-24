import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useEventRsvpsQuery, useUpsertRsvpMutation } from "../events/hooks/useRsvpsQuery.js";
import { RaincheckFlow } from "../events/RaincheckFlow.jsx";

function formatCountdown(startsAt, nowMs) {
  const start = Date.parse(startsAt);
  if (!Number.isFinite(start)) return null;
  const diff = start - nowMs;
  if (diff <= 0) return "Starting soon";
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${remHours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatWhen(startsAt) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startsAt));
}

/**
 * Hub T7 — next-match hero with seats + quick RSVP / raincheck.
 */
export function NextMatchHero({ event }) {
  const [raincheckOpen, setRaincheckOpen] = useState(false);
  const [nowMs] = useState(() => Date.now());
  const rsvpQuery = useEventRsvpsQuery(event?.id, Boolean(event?.id));
  const upsert = useUpsertRsvpMutation(event?.id);

  const seats = rsvpQuery.data?.seats;
  const mine = rsvpQuery.data?.mine?.status || null;
  const rsvpClosed = Boolean(rsvpQuery.data?.rsvpClosed || event?.rsvpClosed);
  const countdown = useMemo(
    () => (event ? formatCountdown(event.startsAt, nowMs) : null),
    [event, nowMs]
  );

  if (!event) {
    return (
      <section
        className="glass-surface flex shrink-0 min-w-0 flex-col justify-center gap-2 rounded-[1.375rem] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-6"
        aria-labelledby="next-match-title"
      >
        <p className="m-0 text-[0.68rem] font-light uppercase tracking-[0.18em] text-white/40">
          Next match
        </p>
        <h2 className="m-0 text-xl font-medium tracking-wide text-white" id="next-match-title">
          Nothing scheduled
        </h2>
        <p className="m-0 text-[0.85rem] text-white/45">
          Add events from{" "}
          <Link to="/calendar" className="text-sky-200/90 no-underline hover:text-sky-100">
            Calendar
          </Link>
          .
        </p>
      </section>
    );
  }

  const opponent = event.match?.opponent;
  const seatLabel =
    seats?.target != null
      ? `${seats.confirmed} / ${seats.target} in`
      : rsvpQuery.data?.uiCounts
        ? `${rsvpQuery.data.uiCounts.in} in`
        : "…";

  const mineUi =
    mine === "waitlist" ? "tentative" : mine === "unavailable" ? "declined" : mine;

  return (
    <section
      className="glass-surface flex shrink-0 min-w-0 flex-col gap-4 rounded-[1.375rem] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-6"
      aria-labelledby="next-match-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[0.68rem] font-light uppercase tracking-[0.18em] text-white/40">
            Next match{countdown ? ` · ${countdown}` : ""}
          </p>
          <h2 className="m-0 mt-1.5 text-xl font-medium tracking-wide text-white" id="next-match-title">
            {event.title}
          </h2>
          <p className="m-0 mt-1 text-[0.85rem] text-white/50">
            {formatWhen(event.startsAt)}
            {opponent ? ` · vs ${opponent}` : ""}
            {` · ${seatLabel}`}
            {seats?.lookingForFills ? " · looking for fills" : ""}
            {rsvpClosed ? " · RSVP closed" : ""}
          </p>
        </div>
        <Link
          to={`/events/${event.id}`}
          className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[0.75rem] text-white/80 no-underline transition hover:border-white/25 hover:text-white"
        >
          Open brief
        </Link>
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        {!rsvpClosed ? (
          <>
            <button
              type="button"
              disabled={upsert.isPending}
              className={`rounded-full border px-3.5 py-1.5 text-[0.8rem] transition disabled:opacity-45 ${
                mineUi === "confirmed"
                  ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
                  : "border-white/15 bg-white/[0.06] text-white/85 hover:bg-white/10"
              }`}
              onClick={() => upsert.mutate({ status: "confirmed" })}
            >
              In
            </button>
            <button
              type="button"
              disabled={upsert.isPending}
              className={`rounded-full border px-3.5 py-1.5 text-[0.8rem] transition disabled:opacity-45 ${
                mineUi === "tentative"
                  ? "border-amber-400/40 bg-amber-400/15 text-amber-100"
                  : "border-white/15 bg-white/[0.06] text-white/85 hover:bg-white/10"
              }`}
              onClick={() => upsert.mutate({ status: "tentative" })}
            >
              Maybe
            </button>
            <button
              type="button"
              disabled={upsert.isPending}
              className={`rounded-full border px-3.5 py-1.5 text-[0.8rem] transition disabled:opacity-45 ${
                mineUi === "declined"
                  ? "border-red-400/40 bg-red-500/15 text-red-100"
                  : "border-white/15 bg-white/[0.06] text-white/85 hover:bg-white/10"
              }`}
              onClick={() => upsert.mutate({ status: "declined" })}
            >
              Out
            </button>
          </>
        ) : mine === "confirmed" ? (
          <button
            type="button"
            className="rounded-full border border-red-400/40 bg-red-500/15 px-3.5 py-1.5 text-[0.8rem] text-red-100 transition hover:bg-red-500/22"
            onClick={() => setRaincheckOpen(true)}
          >
            Raincheck
          </button>
        ) : mineUi ? (
          <span className="self-center text-[0.75rem] text-white/55">
            {mineUi === "confirmed" ? "In" : mineUi === "tentative" ? "Maybe" : "Out"}
          </span>
        ) : null}
      </div>

      {upsert.error ? (
        <p className="m-0 text-[0.75rem] text-red-200/90">{upsert.error.message}</p>
      ) : null}

      <RaincheckFlow
        open={raincheckOpen}
        onClose={() => setRaincheckOpen(false)}
        initialEventId={event.id}
      />
    </section>
  );
}
