import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthGate.jsx";
import { Button } from "../../shared/Button.jsx";
import { Modal } from "../../shared/Modal.jsx";
import { Spinner } from "../../shared/Spinner.jsx";
import {
  EVENT_TYPES,
  useCreateEventMutation,
  useDeleteEventMutation,
  useEventsByMonthQuery,
  useUpdateEventMutation,
} from "./hooks/useEventsQuery.js";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EDITOR_ROLES = ["editor", "assist", "admin", "owner"];

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function localDateTimeValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildMonthDays(monthDate) {
  const first = startOfMonth(monthDate);
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function eventsForDay(events, day) {
  return events.filter((event) => sameDay(new Date(event.startsAt), day));
}

function EventForm({ initialEvent, selectedDay, onSubmit, onDelete, pending, error, canDelete }) {
  const baseDate = initialEvent ? new Date(initialEvent.startsAt) : selectedDay;
  const [title, setTitle] = useState(initialEvent?.title || "");
  const [eventType, setEventType] = useState(initialEvent?.eventType || "scrim");
  const [startsAt, setStartsAt] = useState(localDateTimeValue(baseDate));
  const [endsAt, setEndsAt] = useState(
    initialEvent?.endsAt ? localDateTimeValue(new Date(initialEvent.endsAt)) : ""
  );
  const [description, setDescription] = useState(initialEvent?.description || "");

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      title: title.trim(),
      eventType,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : "",
      description: description.trim(),
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Title</span>
        <input className="glass-input w-full" value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Type</span>
          <select className="glass-input w-full" value={eventType} onChange={(event) => setEventType(event.target.value)}>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Starts</span>
          <input className="glass-input w-full" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Ends</span>
        <input className="glass-input w-full" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Notes</span>
        <textarea className="glass-input min-h-24 w-full" value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <div className="flex flex-wrap justify-between gap-3">
        {canDelete ? (
          <Button type="button" variant="ghost" onClick={onDelete} disabled={pending}>
            Delete
          </Button>
        ) : <span />}
        <Button type="submit" disabled={!title.trim() || pending}>
          {pending ? "Saving..." : "Save event"}
        </Button>
      </div>
    </form>
  );
}

export function CalendarPage() {
  const user = useAuth();
  const canEdit = EDITOR_ROLES.includes(user.role);
  const [monthDate, setMonthDate] = useState(startOfMonth(new Date()));
  const [modalState, setModalState] = useState(null);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth() + 1;
  const eventsQuery = useEventsByMonthQuery(year, month);
  const createEvent = useCreateEventMutation();
  const updateEvent = useUpdateEventMutation();
  const deleteEvent = useDeleteEventMutation();
  const days = useMemo(() => buildMonthDays(monthDate), [monthDate]);
  const events = eventsQuery.data?.events || [];
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(monthDate);

  function shiftMonth(delta) {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function openCreate(day) {
    if (!canEdit) return;
    const selectedDay = new Date(day);
    selectedDay.setHours(19, 0, 0, 0);
    setModalState({ mode: "create", selectedDay });
  }

  function openEdit(event) {
    setModalState({ mode: canEdit ? "edit" : "view", event });
  }

  function closeModal() {
    setModalState(null);
  }

  function submitEvent(event) {
    if (modalState?.mode === "edit") {
      updateEvent.mutate({ id: modalState.event.id, event }, { onSuccess: closeModal });
      return;
    }
    createEvent.mutate(event, { onSuccess: closeModal });
  }

  function handleDelete() {
    if (!modalState?.event || !window.confirm("Delete this event?")) return;
    deleteEvent.mutate(modalState.event.id, { onSuccess: closeModal });
  }

  const mutationError = createEvent.error?.message || updateEvent.error?.message || deleteEvent.error?.message;

  return (
    <section className="animate-fade-up space-y-6">
      <div className="glass-panel p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-accent">Event schedule</p>
            <h1 className="mt-3 text-4xl font-medium tracking-wide md:text-5xl">{monthLabel}</h1>
            <p className="mt-3 text-sm text-muted">
              {canEdit ? "Schedule scrims, comps, and practice blocks." : "View upcoming Circle events."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => shiftMonth(-1)}>Previous</Button>
            <Button variant="secondary" onClick={() => setMonthDate(startOfMonth(new Date()))}>Today</Button>
            <Button variant="secondary" onClick={() => shiftMonth(1)}>Next</Button>
          </div>
        </div>
      </div>

      {eventsQuery.error ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          {eventsQuery.error.message}
        </p>
      ) : null}

      <div className="glass-panel overflow-hidden p-3 md:p-5">
        <div className="grid grid-cols-7 gap-2 pb-3 text-center text-xs uppercase tracking-[0.18em] text-muted">
          {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
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
                onClick={() => openCreate(day)}
                onKeyDown={(keyEvent) => {
                  if (keyEvent.key === "Enter") openCreate(day);
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
                        openEdit(event);
                      }}
                      onKeyDown={(keyEvent) => {
                        if (keyEvent.key === "Enter") {
                          keyEvent.stopPropagation();
                          openEdit(event);
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
        {eventsQuery.isLoading ? (
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

      <Modal
        open={Boolean(modalState)}
        onClose={closeModal}
        title={modalState?.mode === "view" ? "Event details" : "Event"}
      >
        {modalState?.mode === "view" ? (
          <div className="space-y-3 text-sm">
            <p className="text-xl font-medium">{modalState.event.title}</p>
            <p className="uppercase tracking-[0.16em] text-accent">{modalState.event.eventType}</p>
            <p className="text-muted">{new Date(modalState.event.startsAt).toLocaleString()}</p>
            {modalState.event.description ? <p>{modalState.event.description}</p> : null}
          </div>
        ) : modalState ? (
          <EventForm
            initialEvent={modalState.event}
            selectedDay={modalState.selectedDay}
            onSubmit={submitEvent}
            onDelete={handleDelete}
            pending={createEvent.isPending || updateEvent.isPending || deleteEvent.isPending}
            error={mutationError}
            canDelete={modalState.mode === "edit"}
          />
        ) : null}
      </Modal>
    </section>
  );
}
