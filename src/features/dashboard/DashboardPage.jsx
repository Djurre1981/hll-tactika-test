import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthGate.jsx";
import { Spinner } from "../../shared/Spinner.jsx";
import { StatCard } from "./StatCard.jsx";
import { useDashboardQuery } from "./hooks/useDashboardQuery.js";

function formatEventTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function DashboardPage() {
  const user = useAuth();
  const { strats, upcoming } = useDashboardQuery();
  const events = upcoming.data?.events || [];
  const name = user.name || "operator";

  return (
    <section className="animate-fade-up space-y-6">
      <div className="glass-panel p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-accent">Operations overview</p>
            <h1 className="mt-3 text-4xl font-medium tracking-wide md:text-5xl">
              Welcome back, {name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              A minimal command surface for strats, scheduled ops, and the next tactical move.
            </p>
          </div>
          <Link className="glass-control" to="/calendar">
            Open calendar
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <StatCard
            label="Active strats"
            value={strats.data ?? 0}
            detail="available in browser"
            loading={strats.isLoading}
            error={strats.error}
          />
          <StatCard
            label="Upcoming events"
            value={events.length}
            detail="next 45 days"
            loading={upcoming.isLoading}
            error={upcoming.error}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="glass-panel p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium uppercase tracking-[0.22em] text-muted">
              Upcoming
            </h2>
            {upcoming.isFetching ? <Spinner className="h-4 w-4" /> : null}
          </div>

          {upcoming.error ? (
            <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
              {upcoming.error.message}
            </p>
          ) : events.length ? (
            <div className="grid gap-3">
              {events.map((event) => (
                <article key={event.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-lg font-medium">{event.title}</p>
                    <span className="rounded-full border border-accent/30 px-3 py-1 text-xs uppercase tracking-[0.16em] text-accent">
                      {event.eventType}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{formatEventTime(event.startsAt)}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted">
              No events scheduled yet. Add the first one from Calendar.
            </p>
          )}
        </section>

        <section className="glass-panel p-5">
          <h2 className="text-sm font-medium uppercase tracking-[0.22em] text-muted">
            Circle tools
          </h2>
          <div className="mt-4 grid gap-3">
            <Link className="glass-surface p-4 transition hover:border-accent/40" to="/strats">
              <span className="block text-lg font-medium">Strats</span>
              <span className="mt-1 block text-sm text-muted">Browse and prepare tactical plans.</span>
            </Link>
            <Link className="glass-surface p-4 transition hover:border-accent/40" to="/calendar">
              <span className="block text-lg font-medium">Calendar</span>
              <span className="mt-1 block text-sm text-muted">Schedule scrims, comps, and prep.</span>
            </Link>
            <a className="glass-surface p-4 transition hover:border-accent/40" href="/climbing-guide-v1/">
              <span className="block text-lg font-medium">Climbing guide</span>
              <span className="mt-1 block text-sm text-muted">Open the current climb and MG map.</span>
            </a>
          </div>
        </section>
      </div>
    </section>
  );
}
