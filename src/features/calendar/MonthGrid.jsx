import { Spinner } from "../../shared/Spinner.jsx";
import { WEEKDAYS, eventsForDay, sameDay } from "./calendar-utils.js";

const DOT_COLORS = {
  scrim: "bg-[#7ec8ff]",
  comp: "bg-[#57d889]",
  practice: "bg-accent",
  other: "bg-white/45",
};

export function MonthGrid({
  days,
  monthDate,
  events,
  selectedDay,
  canEdit,
  isLoading,
  onSelectDay,
  compact = false,
  onCreateDay,
  onOpenEvent,
}) {
  if (compact) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((day) => (
            <span
              key={day}
              className="grid min-h-[1.85rem] place-items-center rounded-full bg-white/[0.05] text-[0.68rem] uppercase tracking-[0.12em] text-white/45"
            >
              {day}
            </span>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[repeat(6,minmax(3.4rem,auto))] gap-1.5 lg:grid-rows-[repeat(6,minmax(0,1fr))]">
          {days.map((day) => {
            const dayEvents = eventsForDay(events, day);
            const inMonth = day.getMonth() === monthDate.getMonth();
            const isToday = sameDay(day, new Date());
            const isSelected = selectedDay && sameDay(day, selectedDay);
            return (
              <button
                key={day.toISOString()}
                type="button"
                className={[
                  "flex min-h-0 flex-col items-start justify-between gap-1.5 rounded-[14px] border border-white/[0.08] bg-white/[0.035] px-2.5 pb-1.5 pt-2 text-left text-white/90 transition hover:border-white/15 hover:bg-white/[0.07]",
                  inMonth ? "" : "text-white/30",
                  isToday ? "border-neon/35 shadow-[inset_0_0_0_1px_rgba(57,255,20,0.12)]" : "",
                  isSelected ? "border-accent/45 bg-white/10" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onSelectDay?.(day)}
                onDoubleClick={() => {
                  if (canEdit) onCreateDay?.(day);
                }}
              >
                <span className="text-[0.88rem] font-medium">{day.getDate()}</span>
                {dayEvents.length > 0 ? (
                  <span className="flex flex-wrap gap-0.5" aria-hidden="true">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className={`h-[0.35rem] w-[0.35rem] rounded-full ${DOT_COLORS[event.eventType] || DOT_COLORS.other}`}
                      />
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {isLoading ? (
          <div className="mt-1 flex items-center gap-2.5 text-[0.82rem] text-white/45">
            <Spinner />
            <span>Loading events…</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden p-3 md:p-5">
      <div className="grid grid-cols-7 gap-2 pb-3 text-center text-xs uppercase tracking-[0.18em] text-muted">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayEvents = eventsForDay(events, day);
          const inMonth = day.getMonth() === monthDate.getMonth();
          const isToday = sameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              role={canEdit ? "button" : undefined}
              tabIndex={canEdit ? 0 : undefined}
              onClick={() => onCreateDay(day)}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === "Enter") onCreateDay(day);
              }}
              className={`min-h-28 rounded-3xl border p-3 text-left transition ${
                isToday
                  ? "border-neon/60 bg-neon/10 shadow-neon"
                  : "border-white/10 bg-white/[0.045] hover:border-accent/40 hover:bg-white/[0.08]"
              } ${inMonth ? "text-text" : "text-muted/45"}`}
            >
              <span className="text-sm font-medium">{day.getDate()}</span>
              <div className="mt-3 space-y-2">
                {dayEvents.slice(0, 3).map((event) => (
                  <span
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      onOpenEvent(event);
                    }}
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key === "Enter") {
                        keyEvent.stopPropagation();
                        onOpenEvent(event);
                      }
                    }}
                    className="block rounded-xl border border-accent/20 bg-black/25 px-2 py-1 text-xs text-text hover:border-accent/60"
                  >
                    {event.title}
                  </span>
                ))}
                {dayEvents.length > 3 ? (
                  <span className="block text-xs text-muted">+{dayEvents.length - 3} more</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {isLoading ? (
        <div className="mt-4 flex items-center gap-3 text-muted">
          <Spinner />
          <span>Loading events...</span>
        </div>
      ) : !events.length ? (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted">
          No events scheduled this month.
        </p>
      ) : null}
    </div>
  );
}
