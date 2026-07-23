import { useEffect, useMemo, useRef, useState } from "react";
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
import { fieldLabel } from "../strats/editor/editorUi.js";
import {
  eventPropertiesToRoutePlanPatch,
  findLinkedEventIdForRoutePlan,
  formatRoutePlanEventOption,
  isUpcomingEvent,
} from "./event-route-sync.js";

const CREATE_VALUE = "__create_event__";

export function RoutePlanEventPicker({
  planId,
  eventId,
  onEventIdChange,
  onPatchPlan,
}) {
  const user = useAuth();
  const canEdit = canEditEvents(user.role);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const backfillRef = useRef(false);
  const createEvent = useCreateEventMutation();
  const componentsMutation = useEventComponentsMutation();

  const rangeStart = useMemo(() => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    return day;
  }, []);

  const eventsQuery = useEventsRangeQuery({ from: rangeStart, enabled: Boolean(planId) });
  const allEvents = eventsQuery.data?.events || [];

  const upcomingEvents = useMemo(
    () => allEvents.filter((event) => isUpcomingEvent(event)).sort(
      (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)
    ),
    [allEvents]
  );

  const linkedEventId = useMemo(() => {
    const hubId = findLinkedEventIdForRoutePlan(allEvents, planId);
    return hubId || eventId || "";
  }, [allEvents, planId, eventId]);

  const linkedEvent = useMemo(
    () => allEvents.find((event) => event.id === linkedEventId) || null,
    [allEvents, linkedEventId]
  );

  const createDefaultDay = useMemo(() => {
    const day = new Date();
    day.setHours(19, 0, 0, 0);
    return day;
  }, []);

  const eventOptions = useMemo(() => {
    const opts = upcomingEvents.map((event) => ({
      value: event.id,
      label: formatRoutePlanEventOption(event),
    }));
    if (linkedEventId && !opts.some((opt) => opt.value === linkedEventId)) {
      const orphan = allEvents.find((event) => event.id === linkedEventId);
      if (orphan) {
        opts.unshift({
          value: linkedEventId,
          label: `${formatRoutePlanEventOption(orphan)} (past)`,
        });
      } else {
        opts.unshift({ value: linkedEventId, label: "Linked event (outside list)" });
      }
    }
    if (canEdit) {
      opts.push({ value: CREATE_VALUE, label: "+ Create new event…" });
    }
    return opts;
  }, [upcomingEvents, linkedEventId, allEvents, canEdit]);

  async function detachRoutePlanFromEvent(targetEventId) {
    if (!targetEventId) return;
    await componentsMutation.mutateAsync({
      eventId: targetEventId,
      action: "detach",
      type: "routePlan",
      id: planId,
    });
  }

  async function attachRoutePlanToEvent(targetEventId) {
    await componentsMutation.mutateAsync({
      eventId: targetEventId,
      action: "attach",
      type: "routePlan",
      id: planId,
    });
  }

  async function handleEventChange(nextEventId) {
    if (!canEdit || !planId || pending) return;
    if (nextEventId === linkedEventId) return;

    setError("");
    setPending(true);

    try {
      const eventsWithPlan = allEvents.filter((event) =>
        event.components?.routePlanIds?.includes(planId)
      );

      for (const event of eventsWithPlan) {
        if (event.id !== nextEventId) {
          await detachRoutePlanFromEvent(event.id);
        }
      }

      if (!nextEventId) {
        onEventIdChange?.(null);
        return;
      }

      const selected =
        upcomingEvents.find((event) => event.id === nextEventId)
        || allEvents.find((event) => event.id === nextEventId);

      if (!selected) {
        setError("Event not found.");
        return;
      }

      if (!selected.components?.routePlanIds?.includes(planId)) {
        await attachRoutePlanToEvent(nextEventId);
      }

      onEventIdChange?.(nextEventId);

      const patch = eventPropertiesToRoutePlanPatch(selected);
      if (Object.keys(patch).length) {
        await onPatchPlan?.(patch);
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

  useEffect(() => {
    if (!canEdit || !planId || !eventId || backfillRef.current || eventsQuery.isLoading) return;

    const hubId = findLinkedEventIdForRoutePlan(allEvents, planId);
    if (hubId) return;

    backfillRef.current = true;
    attachRoutePlanToEvent(eventId).catch(() => {
      backfillRef.current = false;
    });
  }, [canEdit, planId, eventId, allEvents, eventsQuery.isLoading]);

  return (
    <>
      <label className="block">
        <span className={fieldLabel}>Linked event</span>
        <p className="m-0 mb-1.5 text-[0.64rem] leading-snug text-white/40">
          Attach this route plan to a calendar event so it appears on the match brief. Map and
          faction copy from the event once.
        </p>
        <GlassSelect
          value={linkedEventId}
          disabled={!canEdit || pending || eventsQuery.isLoading}
          onChange={handleSelectChange}
          placeholder="None"
          options={eventOptions}
        />
      </label>

      {linkedEvent ? (
        <Link
          to={`/events/${linkedEvent.id}`}
          className="mt-1.5 inline-block text-[0.72rem] text-accent no-underline hover:underline"
        >
          Open Match Brief
        </Link>
      ) : null}

      {error ? (
        <p className="m-0 mt-1.5 text-[0.64rem] text-red-300/90">{error}</p>
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
