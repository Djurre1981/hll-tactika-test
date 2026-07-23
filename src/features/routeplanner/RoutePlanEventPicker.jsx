import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthGate.jsx";
import { GlassSelect } from "../../shared/GlassSelect.jsx";
import { Modal } from "../../shared/Modal.jsx";
import { EventForm } from "../calendar/EventForm.jsx";
import { canEditEvents } from "../calendar/calendar-utils.js";
import {
  useCreateEventMutation,
  useEventsRangeQuery,
} from "../calendar/hooks/useEventsQuery.js";
import { fieldLabel } from "../strats/editor/editorUi.js";

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

  const eventOptions = useMemo(() => {
    const opts = events.map((event) => ({
      value: event.id,
      label: formatEventOption(event),
    }));
    if (eventId && !linkedEvent) {
      opts.unshift({ value: eventId, label: "Linked event (outside list)" });
    }
    if (canEdit) {
      opts.push({ value: CREATE_VALUE, label: "+ Create new event…" });
    }
    return opts;
  }, [events, eventId, linkedEvent, canEdit]);

  function handleSelectChange(value) {
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
        <GlassSelect
          className="mt-1.5"
          value={eventId || ""}
          disabled={!canEdit || eventsQuery.isLoading}
          onChange={handleSelectChange}
          placeholder="None"
          options={eventOptions}
        />
      </label>

      {linkedEvent ? (
        <p className="m-0 mt-1.5 text-[0.64rem] leading-snug text-white/40">
          {formatEventOption(linkedEvent)}
        </p>
      ) : null}

      {eventsQuery.error ? (
        <p className="m-0 mt-1.5 text-[0.64rem] text-red-300/90">{eventsQuery.error.message}</p>
      ) : null}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} size="wide" title="Event">
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
