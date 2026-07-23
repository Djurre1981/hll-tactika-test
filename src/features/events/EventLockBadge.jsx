import {
  enrichEventLockState,
  eventLockLabel,
  isEventEffectivelyLocked,
} from "./event-lock.js";

export function EventLockIcon({ locked, className = "", title }) {
  return (
    <i
      className={`fa-solid ${locked ? "fa-lock" : "fa-lock-open"} ${className}`}
      aria-hidden="true"
      title={title}
    />
  );
}

export function EventLockBadge({ event, className = "" }) {
  const locked = isEventEffectivelyLocked(event);
  const reason = event?.lockReason ?? (locked ? "manual" : null);
  const label = eventLockLabel(reason);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.68rem] uppercase tracking-[0.1em] ${
        locked
          ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
          : "border-white/10 bg-white/[0.04] text-white/45"
      } ${className}`}
      title={label}
    >
      <EventLockIcon locked={locked} className="text-[0.62rem]" />
      <span>{locked ? "Locked" : "Unlocked"}</span>
    </span>
  );
}

export function useEventLockView(event) {
  return enrichEventLockState(event || {});
}
