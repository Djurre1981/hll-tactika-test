import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthGate.jsx";
import { useFadeIn } from "../../shared/hooks/useFadeIn.js";
import { Button } from "../../shared/Button.jsx";
import { Modal } from "../../shared/Modal.jsx";
import {
  canUnlockEvents,
  enrichEventLockState,
  isEventEffectivelyLocked,
} from "../events/event-lock.js";
import { DayDetails } from "./DayDetails.jsx";
import { EventForm } from "./EventForm.jsx";
import { MonthGrid } from "./MonthGrid.jsx";
import {
  buildMonthDays,
  canEditEvents,
  eventsForDay,
  startOfMonth,
} from "./calendar-utils.js";
import {
  useCreateEventMutation,
  useDeleteEventMutation,
  useEventLockMutation,
  useEventsByMonthQuery,
  useUpdateEventMutation,
} from "./hooks/useEventsQuery.js";

const navBtnClass =
  "grid h-[2.2rem] w-[2.2rem] place-items-center rounded-full border border-white/12 bg-white/[0.05] text-base text-white/80 transition hover:border-white/20 hover:bg-white/10";

export function CalendarPage({ hub = false }) {
  const user = useAuth();
  const canEdit = canEditEvents(user.role);
  const [monthDate, setMonthDate] = useState(startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [modalState, setModalState] = useState(null);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth() + 1;
  const eventsQuery = useEventsByMonthQuery(year, month);
  const createEvent = useCreateEventMutation();
  const updateEvent = useUpdateEventMutation();
  const deleteEvent = useDeleteEventMutation();
  const lockEvent = useEventLockMutation();
  const days = useMemo(() => buildMonthDays(monthDate), [monthDate]);
  const events = eventsQuery.data?.events || [];
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(monthDate);
  const monthEventCount = events.length;
  const selectedDayCount = eventsForDay(events, selectedDay).length;

  function shiftMonth(delta) {
    setMonthDate((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
      setSelectedDay(new Date(next.getFullYear(), next.getMonth(), 1));
      return next;
    });
  }

  function openCreate(day) {
    if (!canEdit) return;
    const selected = new Date(day);
    selected.setHours(19, 0, 0, 0);
    setSelectedDay(day);
    setModalState({ mode: "create", selectedDay: selected });
  }

  function openEditEvent(event) {
    if (!canEdit) return;
    setModalState({ mode: "edit", event });
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

  function refreshModalEvent(event) {
    setModalState((current) =>
      current?.mode === "edit" && current.event?.id === event?.id
        ? { ...current, event }
        : current
    );
  }

  function handleLockEvent() {
    if (!modalState?.event?.id) return;
    lockEvent.mutate(
      { id: modalState.event.id, lock: true },
      { onSuccess: refreshModalEvent }
    );
  }

  function handleUnlockEvent() {
    if (!modalState?.event?.id) return;
    lockEvent.mutate(
      { id: modalState.event.id, lock: false },
      { onSuccess: refreshModalEvent }
    );
  }

  const editEvent =
    modalState?.mode === "edit" && modalState.event
      ? enrichEventLockState(modalState.event)
      : null;
  const effectiveLocked = editEvent ? isEventEffectivelyLocked(editEvent) : false;

  const mutationError =
    createEvent.error?.message ||
    updateEvent.error?.message ||
    deleteEvent.error?.message ||
    lockEvent.error?.message;
  const sectionStyle = useFadeIn();

  const modal = (
    <Modal
      open={Boolean(modalState)}
      onClose={closeModal}
      size="wide"
      title="Event"
    >
      {modalState ? (
        <EventForm
          key={modalState.event?.id || "create"}
          initialEvent={editEvent || modalState.event}
          selectedDay={modalState.selectedDay}
          existingEvents={events}
          onSubmit={submitEvent}
          onDelete={handleDelete}
          onLock={handleLockEvent}
          onUnlock={handleUnlockEvent}
          pending={createEvent.isPending || updateEvent.isPending || deleteEvent.isPending}
          lockPending={lockEvent.isPending}
          error={mutationError}
          canDelete={modalState.mode === "edit"}
          readOnly={modalState.mode === "edit" && effectiveLocked}
          effectiveLocked={effectiveLocked}
          lockReason={editEvent?.lockReason ?? null}
          canLock={modalState.mode === "edit" && canEdit && !effectiveLocked}
          canUnlock={
            modalState.mode === "edit" &&
            canUnlockEvents(user.role) &&
            effectiveLocked
          }
        />
      ) : null}
    </Modal>
  );

  if (hub) {
    return (
      <div
        className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
        data-hub-fill
        style={sectionStyle}
      >
        {eventsQuery.error ? (
          <p className="mb-3 min-h-[1.2rem] text-[0.82rem] text-[#f0a8a8]">{eventsQuery.error.message}</p>
        ) : null}
        <div className="grid h-auto min-h-0 flex-1 grid-cols-1 gap-5 overflow-auto lg:h-full lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,0.85fr)] lg:overflow-hidden">
          <section className="flex min-h-0 flex-col">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="m-0 text-[1.65rem] font-medium tracking-wide text-white">
                  {monthLabel}
                </h1>
                <p className="mt-1 text-[0.8rem] text-white/40">
                  {monthEventCount} event{monthEventCount === 1 ? "" : "s"} this month
                  {selectedDayCount ? ` · ${selectedDayCount} on selected day` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className={navBtnClass}
                  aria-label="Previous month"
                  onClick={() => shiftMonth(-1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className={navBtnClass}
                  aria-label="Today"
                  onClick={() => {
                    const today = new Date();
                    setMonthDate(startOfMonth(today));
                    setSelectedDay(today);
                  }}
                >
                  •
                </button>
                <button
                  type="button"
                  className={navBtnClass}
                  aria-label="Next month"
                  onClick={() => shiftMonth(1)}
                >
                  ›
                </button>
              </div>
            </header>
            <MonthGrid
              compact
              days={days}
              monthDate={monthDate}
              events={events}
              selectedDay={selectedDay}
              canEdit={canEdit}
              isLoading={eventsQuery.isLoading}
              onSelectDay={setSelectedDay}
              onCreateDay={openCreate}
            />
          </section>
          <DayDetails
            selectedDay={selectedDay}
            canEdit={canEdit}
            onAdd={openCreate}
            onEditEvent={openEditEvent}
          />
        </div>
        {modal}
      </div>
    );
  }

  return (
    <section className="space-y-6" style={sectionStyle}>
      <div className="glass-panel p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-accent">Event schedule</p>
            <h1 className="mt-3 text-4xl font-medium tracking-wide md:text-5xl">{monthLabel}</h1>
            <p className="mt-3 text-sm text-muted">
              {canEdit
                ? "Schedule scrims, comps, and practice blocks."
                : "View upcoming Circle events."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => shiftMonth(-1)}>
              Previous
            </Button>
            <Button variant="secondary" onClick={() => setMonthDate(startOfMonth(new Date()))}>
              Today
            </Button>
            <Button variant="secondary" onClick={() => shiftMonth(1)}>
              Next
            </Button>
          </div>
        </div>
      </div>

      {eventsQuery.error ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          {eventsQuery.error.message}
        </p>
      ) : null}

      <MonthGrid
        days={days}
        monthDate={monthDate}
        events={events}
        canEdit={canEdit}
        isLoading={eventsQuery.isLoading}
        onCreateDay={openCreate}
      />
      {modal}
    </section>
  );
}
