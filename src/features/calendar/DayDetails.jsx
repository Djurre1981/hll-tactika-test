import { eventsForDay } from "./calendar-utils.js";

const TYPE_LABELS = {
  scrim: "Scrim",
  comp: "Comp",
  practice: "Practice",
  other: "Other",
};

function formatTime(iso) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDayLabel(day) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(day);
}

export function DayDetails({
  selectedDay,
  events,
  canEdit,
  isLoading,
  onAdd,
  onOpenEvent,
}) {
  const dayEvents = eventsForDay(events, selectedDay).sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  );

  return (
    <aside className="flex min-h-0 flex-col overflow-auto rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[0.68rem] uppercase tracking-[0.16em] text-white/40">Schedule</p>
          <h2 className="mt-1.5 text-[1.15rem] font-medium text-white">
            {formatDayLabel(selectedDay)}
          </h2>
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

      {isLoading ? (
        <p className="mt-6 text-[0.9rem] text-white/40">Loading…</p>
      ) : dayEvents.length === 0 ? (
        <p className="mt-6 text-[0.9rem] text-white/40">No events this day.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {dayEvents.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                className="grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 rounded-2xl border border-white/[0.08] bg-black/20 px-3.5 py-3.5 text-left transition hover:border-white/15 hover:bg-white/[0.06]"
                onClick={() => onOpenEvent(event)}
              >
                <span className="whitespace-nowrap text-[0.95rem] font-medium text-white">
                  {formatTime(event.startsAt)}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[0.9rem] text-white/90">{event.title}</span>
                  {event.description ? (
                    <span className="truncate text-[0.78rem] text-white/40">
                      {event.description}
                    </span>
                  ) : null}
                </span>
                <span className="self-center rounded-full bg-emerald-400/15 px-2 py-0.5 text-[0.68rem] capitalize tracking-wide text-emerald-200">
                  {TYPE_LABELS[event.eventType] || event.eventType}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
