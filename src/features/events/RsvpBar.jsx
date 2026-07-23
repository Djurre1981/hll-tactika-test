import { Link } from "react-router-dom";
import { useEventRsvpsQuery, useUpsertRsvpMutation } from "./hooks/useRsvpsQuery.js";

const RSVP_STATUSES = ["confirmed", "tentative", "declined", "unavailable"];

const STATUS_LABELS = {
  confirmed: "In",
  tentative: "Maybe",
  declined: "Out",
  unavailable: "Unavailable",
};

const STATUS_CLASSES = {
  confirmed: "border-emerald-400/35 bg-emerald-400/15 text-emerald-100",
  tentative: "border-amber-400/35 bg-amber-400/12 text-amber-100",
  declined: "border-red-400/30 bg-red-500/12 text-red-100",
  unavailable: "border-white/15 bg-white/[0.06] text-white/60",
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

export function RsvpBar({ eventId }) {
  const rsvpQuery = useEventRsvpsQuery(eventId);
  const upsert = useUpsertRsvpMutation(eventId);

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

  const counts = rsvpQuery.data?.counts || {
    confirmed: 0,
    tentative: 0,
    declined: 0,
    unavailable: 0,
    total: 0,
  };
  const mine = rsvpQuery.data?.mine?.status || null;
  const total = Math.max(counts.total, 1);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-white/45">RSVP</h2>
        <p className="m-0 text-[0.78rem] text-white/50">
          {counts.confirmed} confirmed · {counts.total} responses
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <Segment
          label="In"
          count={counts.confirmed}
          total={total}
          className="bg-emerald-400/70"
        />
        <Segment label="Maybe" count={counts.tentative} total={total} className="bg-amber-400/60" />
        <Segment label="Out" count={counts.declined} total={total} className="bg-red-400/55" />
        <Segment
          label="N/A"
          count={counts.unavailable}
          total={total}
          className="bg-white/25"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {RSVP_STATUSES.map((status) => {
          const active = mine === status;
          return (
            <button
              key={status}
              type="button"
              disabled={upsert.isPending}
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
        })}
      </div>

      {upsert.error ? (
        <p className="m-0 mt-2 text-[0.75rem] text-red-200/90">
          {upsert.error.message || "Could not save RSVP."}
        </p>
      ) : null}

      <p className="m-0 mt-3 text-[0.72rem] text-white/35">
        Attendance for this match. Staff see the pulse on{" "}
        <Link to="/management#overview" className="text-sky-200/80 no-underline hover:text-sky-100">
          Management Overview
        </Link>
        .
      </p>
    </section>
  );
}
