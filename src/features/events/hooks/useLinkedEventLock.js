import { useMemo } from "react";
import { useAuth } from "../../auth/AuthGate.jsx";
import { useEventsRangeQuery } from "../../calendar/hooks/useEventsQuery.js";
import { findLinkedEventIdForWhiteboard } from "../../micro-prep/event-whiteboard-sync.js";
import { findLinkedEventIdForRoutePlan } from "../../routeplanner/event-route-sync.js";
import { findLinkedEventId } from "../../strats/editor/event-strat-sync.js";
import {
  canUnlockEvents,
  enrichEventLockState,
  isEventEffectivelyLocked,
} from "../event-lock.js";

/**
 * Resolve linked calendar event lock state for a strat, route plan, or whiteboard.
 */
export function useLinkedEventLock({ kind, toolId, planEventId = null, enabled = true } = {}) {
  const user = useAuth();

  const rangeStart = useMemo(() => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    return day;
  }, []);

  const eventsQuery = useEventsRangeQuery({
    from: rangeStart,
    enabled: enabled && Boolean(toolId),
  });

  const allEvents = eventsQuery.data?.events || [];

  const linkedEventId = useMemo(() => {
    if (!toolId) return "";
    if (kind === "strat") return findLinkedEventId(allEvents, toolId);
    if (kind === "routePlan") {
      return findLinkedEventIdForRoutePlan(allEvents, toolId) || planEventId || "";
    }
    if (kind === "whiteboard") return findLinkedEventIdForWhiteboard(allEvents, toolId);
    return "";
  }, [kind, toolId, planEventId, allEvents]);

  const linkedEvent = useMemo(() => {
    const raw = allEvents.find((event) => event.id === linkedEventId) || null;
    return raw ? enrichEventLockState(raw) : null;
  }, [allEvents, linkedEventId]);

  const eventLocked = linkedEvent ? isEventEffectivelyLocked(linkedEvent) : false;

  return {
    linkedEventId,
    linkedEvent,
    eventLocked,
    canUnlockLinkedEvent: canUnlockEvents(user?.role),
    isLoading: eventsQuery.isLoading,
  };
}
