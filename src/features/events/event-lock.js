/** Event lock rules — client mirror of functions/lib/event-lock.js */

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

export function isEventEffectivelyLocked(event, now = new Date()) {
  if (event?.lockOverride) return false;
  if (event?.locked) return true;
  return isEventAutoLocked(event, now);
}

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
