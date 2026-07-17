import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthGate.jsx";
import { useFadeIn } from "../../shared/hooks/useFadeIn.js";
import { Button } from "../../shared/Button.jsx";
import { Modal } from "../../shared/Modal.jsx";
import { EventForm } from "./EventForm.jsx";
import { MonthGrid } from "./MonthGrid.jsx";
import {
  buildMonthDays,
  canEditEvents,
  startOfMonth,
} from "./calendar-utils.js";
import {
  useCreateEventMutation,
  useDeleteEventMutation,
  useEventsByMonthQuery,
  useUpdateEventMutation,
} from "./hooks/useEventsQuery.js";

export function CalendarPage({ hub = false }) {
  const user = useAuth();
  const canEdit = canEditEvents(user.role);
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
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(monthDate);

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

  const mutationError =
    createEvent.error?.message || updateEvent.error?.message || deleteEvent.error?.message;
  const sectionStyle = useFadeIn();

  const content = (
    <section className={hub ? "space-y-5" : "space-y-6"} style={sectionStyle}>
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
        onOpenEvent={openEdit}
      />

      <Modal
        open={Boolean(modalState)}
        onClose={closeModal}
        title={modalState?.mode === "view" ? "Event details" : "Event"}
      >
        {modalState?.mode === "view" ? (
          <div className="space-y-3 text-sm">
            <p className="text-xl font-medium">{modalState.event.title}</p>
            <p className="uppercase tracking-[0.16em] text-accent">
              {modalState.event.eventType}
            </p>
            <p className="text-muted">{new Date(modalState.event.startsAt).toLocaleString()}</p>
            {modalState.event.description ? <p>{modalState.event.description}</p> : null}
          </div>
        ) : modalState ? (
          <EventForm
            key={modalState.event?.id || "create"}
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

  if (hub) {
    return <div className="hub-calendar-shell space-y-5">{content}</div>;
  }

  return content;
}
