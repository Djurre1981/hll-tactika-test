import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GlassSelect } from "../../../shared/GlassSelect.jsx";
import {
  useEventComponentsMutation,
  useEventsRangeQuery,
} from "../../calendar/hooks/useEventsQuery.js";
import { EventLockBadge } from "../../events/EventLockBadge.jsx";
import { isEventEffectivelyLocked } from "../../events/event-lock.js";
import {
  accLabel,
  accShell,
  accSummary,
  accValue,
  cx,
} from "./editorUi.js";
import {
  eventPropertiesToStratPatch,
  eventSlideMapId,
  findLinkedEventId,
  formatStratEventOption,
  isUpcomingEvent,
  stratEventSummary,
} from "./event-strat-sync.js";
import { STRAT_MAP_IDS } from "./mapIds.js";

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

export function StratEventLinker({
  stratId,
  activeSlide,
  canEdit,
  onPatchStrat,
  onChangeSlideMap,
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const componentsMutation = useEventComponentsMutation();

  const rangeStart = useMemo(() => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    return day;
  }, []);

  const eventsQuery = useEventsRangeQuery({ from: rangeStart, enabled: Boolean(stratId) });
  const allEvents = eventsQuery.data?.events || [];

  const upcomingEvents = useMemo(
    () => allEvents.filter((event) => isUpcomingEvent(event)).sort(
      (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)
    ),
    [allEvents]
  );

  const linkedEventId = useMemo(
    () => findLinkedEventId(allEvents, stratId),
    [allEvents, stratId]
  );

  const linkedEvent = useMemo(
    () => allEvents.find((event) => event.id === linkedEventId) || null,
    [allEvents, linkedEventId]
  );
  const eventLocked = linkedEvent ? isEventEffectivelyLocked(linkedEvent) : false;
  const canChangeLink = canEdit && !eventLocked;

  const eventOptions = useMemo(() => {
    const opts = upcomingEvents.map((event) => ({
      value: event.id,
      label: formatStratEventOption(event),
    }));
    if (linkedEventId && !opts.some((opt) => opt.value === linkedEventId)) {
      const orphan = allEvents.find((event) => event.id === linkedEventId);
      if (orphan) {
        opts.unshift({
          value: linkedEventId,
          label: `${formatStratEventOption(orphan)} (past)`,
        });
      }
    }
    return opts;
  }, [upcomingEvents, linkedEventId, allEvents]);

  async function detachStratFromEvent(eventId) {
    if (!eventId) return;
    await componentsMutation.mutateAsync({
      eventId,
      action: "detach",
      type: "strat",
      id: stratId,
    });
  }

  async function attachStratToEvent(eventId) {
    await componentsMutation.mutateAsync({
      eventId,
      action: "attach",
      type: "strat",
      id: stratId,
    });
  }

  async function handleEventChange(nextEventId) {
    if (!canChangeLink || !stratId || pending) return;
    if (nextEventId === linkedEventId) return;

    setError("");
    setPending(true);

    try {
      const eventsWithStrat = allEvents.filter((event) =>
        event.components?.stratIds?.includes(stratId)
      );

      for (const event of eventsWithStrat) {
        if (event.id !== nextEventId) {
          await detachStratFromEvent(event.id);
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

      if (!selected.components?.stratIds?.includes(stratId)) {
        await attachStratToEvent(nextEventId);
      }

      const patch = eventPropertiesToStratPatch(selected);
      if (Object.keys(patch).length) {
        await onPatchStrat?.(patch);
      }

      const slideMapId = eventSlideMapId(selected, STRAT_MAP_IDS);
      if (slideMapId && activeSlide?.id && onChangeSlideMap) {
        await onChangeSlideMap(activeSlide.id, slideMapId);
      }
    } catch (linkError) {
      setError(linkError?.message || "Could not link event.");
    } finally {
      setPending(false);
    }
  }

  return (
    <EventAccordion label="Event" value={stratEventSummary(linkedEvent)} defaultOpen>
      <p className="m-0 text-[0.72rem] leading-snug text-white/40">
        Link this strat to a calendar event. Choosing an event attaches it to the match brief and
        copies match details, type, and the active slide map into this strat once.
      </p>
      <GlassSelect
        disabled={!canChangeLink || pending || eventsQuery.isLoading}
        value={linkedEventId}
        onChange={handleEventChange}
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
  );
}
