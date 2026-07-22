import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthGate.jsx";
import { Modal } from "../../shared/Modal.jsx";
import { EventForm } from "../calendar/EventForm.jsx";
import { canEditEvents } from "../calendar/calendar-utils.js";
import {
  useCreateEventMutation,
  useEventsRangeQuery,
} from "../calendar/hooks/useEventsQuery.js";
import { cx, fieldLabel, glassSelect } from "../strats/editor/editorUi.js";

const CREATE_VALUE = "__create_event__";

function formatEventOption(event) {
  const when = new Date(event.startsAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${event.title} · ${when} · ${event.eventType}`;
}

export function RoutePlanEventPicker({ eventId, onEventIdChange }) {
  const user = useAuth();
  const canEdit = canEditEvents(user.role);
  const [createOpen, setCreateOpen] = useState(false);
  const createEvent = useCreateEventMutation();

  const rangeStart = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    return d;
  }, []);

  const eventsQuery = useEventsRangeQuery({ from: rangeStart, enabled: canEdit });
  const events = eventsQuery.data?.events || [];

  const linkedEvent = useMemo(
    () => (eventId ? events.find((event) => event.id === eventId) : null),
    [eventId, events]
  );

  const createDefaultDay = useMemo(() => {
    const day = new Date();
    day.setHours(19, 0, 0, 0);
    return day;
  }, []);

  function handleSelectChange(event) {
    const value = event.target.value;
    if (value === CREATE_VALUE) {
      setCreateOpen(true);
      return;
    }
    onEventIdChange?.(value || null);
  }

  function handleCreateSubmit(eventData) {
    createEvent.mutate(eventData, {
      onSuccess: (data) => {
        const created = data?.event;
        if (created?.id) onEventIdChange?.(created.id);
        setCreateOpen(false);
      },
    });
  }

  return (
    <>
      <label className="block">
        <span className={fieldLabel}>Linked event</span>
        <span className="relative mt-1.5 block">
          <select
            value={eventId || ""}
            disabled={!canEdit || eventsQuery.isLoading}
            onChange={handleSelectChange}
            className={glassSelect}
          >
            <option value="">None</option>
            {eventId && !linkedEvent && (
              <option value={eventId}>Linked event (outside list)</option>
            )}
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {formatEventOption(event)}
              </option>
            ))}
            {canEdit ? <option value={CREATE_VALUE}>+ Create new event…</option> : null}
          </select>
          <i
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[0.65rem] text-white/50 fa-solid fa-chevron-down"
            aria-hidden="true"
          />
        </span>
      </label>

      {linkedEvent ? (
        <p className="m-0 mt-1.5 text-[0.64rem] leading-snug text-white/40">
          {formatEventOption(linkedEvent)}
        </p>
      ) : null}

      {eventsQuery.error ? (
        <p className="m-0 mt-1.5 text-[0.64rem] text-red-300/90">{eventsQuery.error.message}</p>
      ) : null}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Event">
        <EventForm
          key="routeplan-create-event"
          selectedDay={createDefaultDay}
          onSubmit={handleCreateSubmit}
          pending={createEvent.isPending}
          error={createEvent.error?.message}
        />
      </Modal>
    </>
  );
}
