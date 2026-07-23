import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useMyPrepTasksQuery } from "../events/hooks/usePrepTasksQuery.js";

function formatEventTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function MyPrepTasksWidget() {
  const range = useMemo(() => {
    const now = new Date();
    const toDate = new Date(now);
    toDate.setUTCDate(toDate.getUTCDate() + 45);
    return {
      from: now.toISOString(),
      to: toDate.toISOString(),
    };
  }, []);

  const tasksQuery = useMyPrepTasksQuery(range);
  const tasks = tasksQuery.data || [];

  if (tasksQuery.isLoading) {
    return (
      <section className="mb-4 rounded-[1.125rem] border border-white/10 bg-white/[0.04] px-4 py-3">
        <h3 className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-white/45">My tasks</h3>
        <p className="m-0 mt-2 text-[0.78rem] text-white/40">Loading…</p>
      </section>
    );
  }

  if (tasksQuery.error || !tasks.length) {
    return null;
  }

  return (
    <section className="mb-4 rounded-[1.125rem] border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3">
      <h3 className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-amber-200/80">My tasks</h3>
      <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
        {tasks.slice(0, 5).map((task) => (
          <li key={task.id}>
            <Link
              to={`/events/${task.eventId}`}
              className="block rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 no-underline transition hover:border-amber-300/30 hover:bg-black/25"
            >
              <p className="m-0 text-[0.84rem] font-medium text-white">{task.title}</p>
              <p className="m-0 mt-0.5 text-[0.72rem] text-white/45">
                {task.eventTitle} · {formatEventTime(task.eventStartsAt)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {tasks.length > 5 ? (
        <p className="m-0 mt-2 text-[0.68rem] text-white/35">+{tasks.length - 5} more on match briefs</p>
      ) : null}
    </section>
  );
}
