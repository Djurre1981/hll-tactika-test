import { Spinner } from "../../shared/Spinner.jsx";
import { WEEKDAYS, eventsForDay, sameDay } from "./calendar-utils.js";

export function MonthGrid({
  days,
  monthDate,
  events,
  canEdit,
  isLoading,
  onCreateDay,
  onOpenEvent,
}) {
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
