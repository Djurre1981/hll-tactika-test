import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthGate.jsx";
import { GlassSelect } from "../../shared/GlassSelect.jsx";
import { Modal } from "../../shared/Modal.jsx";
import { EventForm } from "../calendar/EventForm.jsx";
import { canEditEvents } from "../calendar/calendar-utils.js";
import {
  useCreateEventMutation,
  useEventComponentsMutation,
  useEventsRangeQuery,
} from "../calendar/hooks/useEventsQuery.js";
import { EventLockBadge } from "../events/EventLockBadge.jsx";
import { isEventEffectivelyLocked } from "../events/event-lock.js";
import {
  accLabel,
  accShell,
  accSummary,
  accValue,
  cx,
} from "../strats/editor/editorUi.js";
import {
  findLinkedEventIdForWhiteboard,
  formatWhiteboardEventOption,
  isUpcomingEvent,
  whiteboardEventSummary,
} from "./event-whiteboard-sync.js";

const CREATE_VALUE = "__create_event__";

function EventAccordion({ label, value, defaultOpen = false, children }) {
  return (
    <details className={cx(accShell, "group")} defaultOpen={defaultOpen}>
      <summary className={accSummary}>
        <span className={accLabel}>{label}</span>
        <span className={accValue}>{value}</span>
        <i
          className="fa-solid fa-chevron-down text-[0.55rem] text-white/35 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="flex flex-col gap-[0.55rem] px-[0.65rem] pb-[0.65rem]">{children}</div>
    </details>
  );
}

export function WhiteboardEventLinker({ whiteboardId, canEditBoard }) {
  const user = useAuth();
  const canEditEventsHub = canEditEvents(user.role);
  const canEdit = canEditBoard && canEditEventsHub;
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const createEvent = useCreateEventMutation();
  const componentsMutation = useEventComponentsMutation();

  const rangeStart = useMemo(() => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    return day;
  }, []);

  const eventsQuery = useEventsRangeQuery({ from: rangeStart, enabled: Boolean(whiteboardId) });
  const allEvents = eventsQuery.data?.events || [];

  const upcomingEvents = useMemo(
    () => allEvents.filter((event) => isUpcomingEvent(event)).sort(
      (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)
    ),
    [allEvents]
  );

  const linkedEventId = useMemo(
    () => findLinkedEventIdForWhiteboard(allEvents, whiteboardId),
    [allEvents, whiteboardId]
  );

  const linkedEvent = useMemo(
    () => allEvents.find((event) => event.id === linkedEventId) || null,
    [allEvents, linkedEventId]
  );
  const eventLocked = linkedEvent ? isEventEffectivelyLocked(linkedEvent) : false;
  const canChangeLink = canEdit && !eventLocked;

  const createDefaultDay = useMemo(() => {
    const day = new Date();
    day.setHours(19, 0, 0, 0);
    return day;
  }, []);

  const eventOptions = useMemo(() => {
    const opts = upcomingEvents.map((event) => ({
      value: event.id,
      label: formatWhiteboardEventOption(event),
    }));
    if (linkedEventId && !opts.some((opt) => opt.value === linkedEventId)) {
      const orphan = allEvents.find((event) => event.id === linkedEventId);
      if (orphan) {
        opts.unshift({
          value: linkedEventId,
          label: `${formatWhiteboardEventOption(orphan)} (past)`,
        });
      }
    }
    if (canEdit) {
      opts.push({ value: CREATE_VALUE, label: "+ Create new event…" });
    }
    return opts;
  }, [upcomingEvents, linkedEventId, allEvents, canEdit]);

  async function detachWhiteboardFromEvent(eventId) {
    if (!eventId) return;
    await componentsMutation.mutateAsync({
      eventId,
      action: "detach",
      type: "whiteboard",
      id: whiteboardId,
    });
  }

  async function attachWhiteboardToEvent(eventId) {
    await componentsMutation.mutateAsync({
      eventId,
      action: "attach",
      type: "whiteboard",
      id: whiteboardId,
    });
  }

  async function handleEventChange(nextEventId) {
    if (!canChangeLink || !whiteboardId || pending) return;
    if (nextEventId === linkedEventId) return;

    setError("");
    setPending(true);

    try {
      const eventsWithBoard = allEvents.filter((event) =>
        event.components?.whiteboardIds?.includes(whiteboardId)
      );

      for (const event of eventsWithBoard) {
        if (event.id !== nextEventId) {
          await detachWhiteboardFromEvent(event.id);
        }
      }

      if (!nextEventId) {
        return;
      }

      const selected =
        upcomingEvents.find((event) => event.id === nextEventId)
        || allEvents.find((event) => event.id === nextEventId);

      if (!selected) {
        setError("Event not found.");
        return;
      }

      if (!selected.components?.whiteboardIds?.includes(whiteboardId)) {
        await attachWhiteboardToEvent(nextEventId);
      }
    } catch (linkError) {
      setError(linkError?.message || "Could not link event.");
    } finally {
      setPending(false);
    }
  }

  function handleSelectChange(value) {
    if (value === CREATE_VALUE) {
      setCreateOpen(true);
      return;
    }
    handleEventChange(value || "");
  }

  function handleCreateSubmit(eventData) {
    createEvent.mutate(eventData, {
      onSuccess: async (data) => {
        const created = data?.event;
        if (created?.id) {
          await handleEventChange(created.id);
        }
        setCreateOpen(false);
      },
    });
  }

  return (
    <>
      <EventAccordion label="Event" value={whiteboardEventSummary(linkedEvent)} defaultOpen>
        <p className="m-0 text-[0.72rem] leading-snug text-white/40">
          Link this slideshow to a calendar event so it appears on the match brief.
        </p>
        <GlassSelect
          disabled={!canChangeLink || pending || eventsQuery.isLoading}
          value={linkedEventId}
          onChange={handleSelectChange}
          placeholder="None"
          options={eventOptions}
        />
        {linkedEvent ? (
          <div className="flex flex-wrap items-center gap-2">
            <EventLockBadge event={linkedEvent} className="scale-90" />
            <Link
              to={`/events/${linkedEvent.id}`}
              className="text-[0.72rem] text-accent no-underline hover:underline"
            >
              Open Match Brief
            </Link>
          </div>
        ) : null}
        {error ? <p className="m-0 text-[0.72rem] text-red-200/90">{error}</p> : null}
      </EventAccordion>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} size="wide" title="Event">
        <EventForm
          key="whiteboard-create-event"
          selectedDay={createDefaultDay}
          onSubmit={handleCreateSubmit}
          pending={createEvent.isPending}
          error={createEvent.error?.message}
        />
      </Modal>
    </>
  );
}
