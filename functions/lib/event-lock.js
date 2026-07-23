/** Event lock rules — shared by events-store and client UI. */

export function isEventPast(event, now = new Date()) {
  const start = Date.parse(event?.startsAt);
  if (!Number.isFinite(start)) return false;
  return start < now.getTime();
}

export function isEventDone(event) {
  const result = String(event?.match?.result || "").trim();
  return result === "win" || result === "loss";
}

export function isEventAutoLocked(event, now = new Date()) {
  return isEventPast(event, now) || isEventDone(event);
}

export function canUnlockEvents(role) {
  return role === "admin" || role === "owner";
}

/** True when event properties should be read-only. */
export function isEventEffectivelyLocked(event, now = new Date()) {
  if (event?.lockOverride) return false;
  if (event?.locked) return true;
  return isEventAutoLocked(event, now);
}

/** manual | done | past | null (unlocked/open) */
export function eventLockReason(event, now = new Date()) {
  if (event?.lockOverride) return null;
  if (event?.locked) return "manual";
  if (isEventDone(event)) return "done";
  if (isEventPast(event, now)) return "past";
  return null;
}

export function eventLockLabel(reason) {
  if (reason === "manual") return "Locked manually";
  if (reason === "done") return "Locked — result recorded";
  if (reason === "past") return "Locked — event date passed";
  return "Unlocked";
}

export function enrichEventLockState(event, now = new Date()) {
  const lockReason = eventLockReason(event, now);
  return {
    ...event,
    effectiveLocked: lockReason !== null,
    lockReason,
  };
}
