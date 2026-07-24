import { useState } from "react";
import { Link } from "react-router-dom";
import { RSVP_REASON_LABELS } from "../../../functions/lib/rsvp-reasons.js";
import { canEnterEditorMode } from "../../lib/roles.js";
import { useAuth } from "../auth/AuthGate.jsx";
import { RaincheckFlow } from "./RaincheckFlow.jsx";
import { useEventRsvpsQuery, useUpsertRsvpMutation } from "./hooks/useRsvpsQuery.js";

const OPEN_STATUSES = ["confirmed", "tentative", "declined"];

const STATUS_LABELS = {
  confirmed: "In",
  tentative: "Maybe",
  declined: "Out",
};

const STATUS_CLASSES = {
  confirmed: "border-emerald-400/35 bg-emerald-400/15 text-emerald-100",
  tentative: "border-amber-400/35 bg-amber-400/12 text-amber-100",
  declined: "border-red-400/30 bg-red-500/12 text-red-100",
};

function Segment({ label, count, total, className }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="min-w-0 flex-1">
      <div className={`h-2 rounded-full ${className}`} style={{ width: `${Math.max(pct, count ? 8 : 0)}%` }} />
      <p className="m-0 mt-1 text-[0.68rem] text-white/45">
        {label} {count}
      </p>
    </div>
  );
}

function reservePosition(rsvps, steamId) {
  const queue = (rsvps || [])
    .filter((row) => row.status === "tentative" || row.status === "waitlist")
    .slice()
    .sort((a, b) => {
      const aq = Date.parse(a.queuedAt || a.updatedAt || 0);
      const bq = Date.parse(b.queuedAt || b.updatedAt || 0);
      return aq - bq;
    });
  const idx = queue.findIndex((row) => row.steamId === steamId);
  return idx >= 0 ? idx + 1 : null;
}

export function RsvpBar({ eventId, event = null }) {
  const user = useAuth();
  const rsvpQuery = useEventRsvpsQuery(eventId);
  const upsert = useUpsertRsvpMutation(eventId);
  const [raincheckOpen, setRaincheckOpen] = useState(false);
  const isEditor = canEnterEditorMode(user.role);

  if (rsvpQuery.isLoading) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-white/45">RSVP</h2>
        <p className="m-0 mt-2 text-[0.82rem] text-white/40">Loading attendance…</p>
      </section>
    );
  }

  if (rsvpQuery.error) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-white/45">RSVP</h2>
        <p className="m-0 mt-2 text-[0.82rem] text-white/45">Could not load RSVPs.</p>
      </section>
    );
  }

  const uiCounts = rsvpQuery.data?.uiCounts || {
    in: 0,
    maybe: 0,
    out: 0,
    total: 0,
  };
  const seats = rsvpQuery.data?.seats || null;
  const mine = rsvpQuery.data?.mine || null;
  const mineStatus = mine?.status || null;
  const rsvps = rsvpQuery.data?.rsvps || [];
  const rsvpClosed = Boolean(rsvpQuery.data?.rsvpClosed || event?.rsvpClosed);
  const total = Math.max(uiCounts.total, 1);
  const myReservePos =
    mineStatus === "tentative" || mineStatus === "waitlist"
      ? reservePosition(rsvps, user.steamId)
      : null;

  const rainchecks = rsvps.filter((row) => row.status === "declined" && row.reasonCode);
  const showReasons = isEditor || (mineStatus === "declined" && mine?.reasonCode);
  const mineUiStatus =
    mineStatus === "waitlist" || mineStatus === "unavailable"
      ? mineStatus === "waitlist"
        ? "tentative"
        : "declined"
      : mineStatus;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-white/45">RSVP</h2>
        <p className="m-0 text-[0.78rem] text-white/50">
          {seats?.target != null
            ? `${seats.confirmed} / ${seats.target} seats`
            : `${uiCounts.in} in · ${uiCounts.total} responses`}
          {rsvpClosed ? " · closed" : ""}
        </p>
      </div>

      {seats?.lookingForFills ? (
        <p className="mt-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-[0.75rem] text-amber-50/90">
          Looking for fills — under target with no reserve list.
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Segment label="In" count={uiCounts.in} total={total} className="bg-emerald-400/70" />
        <Segment label="Maybe" count={uiCounts.maybe} total={total} className="bg-amber-400/60" />
        <Segment label="Out" count={uiCounts.out} total={total} className="bg-red-400/55" />
      </div>

      {myReservePos ? (
        <p className="m-0 mt-3 text-[0.8rem] text-amber-100/90">
          You&apos;re #{myReservePos} on the reserve list (Maybe).
        </p>
      ) : null}

      {mineStatus === "declined" && mine?.reasonCode ? (
        <p className="m-0 mt-3 text-[0.8rem] text-white/55">
          Your raincheck: {RSVP_REASON_LABELS[mine.reasonCode] || mine.reasonCode}
          {mine.reasonNote ? ` — ${mine.reasonNote}` : ""}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {!rsvpClosed
          ? OPEN_STATUSES.map((status) => {
              const active = mineUiStatus === status;
              return (
                <button
                  key={status}
                  type="button"
                  disabled={upsert.isPending}
                  aria-pressed={active}
                  aria-label={STATUS_LABELS[status]}
                  className={`rounded-full border px-3 py-1.5 text-[0.78rem] transition disabled:opacity-50 ${
                    active
                      ? STATUS_CLASSES[status]
                      : "border-white/12 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                  }`}
                  onClick={() => upsert.mutate({ status })}
                >
                  {STATUS_LABELS[status]}
                </button>
              );
            })
          : mineStatus === "confirmed"
            ? (
                <button
                  type="button"
                  aria-pressed={false}
                  className="rounded-full border border-red-400/30 bg-red-500/12 px-3 py-1.5 text-[0.78rem] text-red-100 transition hover:bg-red-500/18"
                  onClick={() => setRaincheckOpen(true)}
                >
                  Raincheck
                </button>
              )
            : mineStatus
              ? (
                  <span className="self-center rounded-full border border-white/12 px-3 py-1.5 text-[0.78rem] text-white/55">
                    {STATUS_LABELS[mineUiStatus] || mineStatus}
                  </span>
                )
              : null}
      </div>

      {rsvpClosed && mineStatus !== "confirmed" ? (
        <p className="m-0 mt-2 text-[0.75rem] text-white/40">RSVP is closed for this event.</p>
      ) : null}

      {upsert.error ? (
        <p className="m-0 mt-2 text-[0.75rem] text-red-200/90">
          {upsert.error.message || "Could not save RSVP."}
        </p>
      ) : null}

      {showReasons && rainchecks.length > 0 && isEditor ? (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="m-0 text-[0.68rem] uppercase tracking-[0.12em] text-white/40">
            Rainchecks
          </p>
          <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
            {rainchecks.slice(0, 8).map((row) => (
              <li key={row.steamId} className="text-[0.78rem] text-white/65">
                <span className="text-white/85">{row.steamId.slice(-6)}</span>
                {" — "}
                {RSVP_REASON_LABELS[row.reasonCode] || row.reasonCode}
                {row.reasonNote ? ` (${row.reasonNote})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="m-0 mt-3 text-[0.72rem] text-white/35">
        Attendance for this match. Staff see the pulse on{" "}
        <Link to="/management#overview" className="text-sky-200/80 no-underline hover:text-sky-100">
          Management Overview
        </Link>
        .
      </p>

      <RaincheckFlow
        open={raincheckOpen}
        onClose={() => setRaincheckOpen(false)}
        initialEventId={eventId}
      />
    </section>
  );
}
