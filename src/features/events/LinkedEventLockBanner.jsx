import { Link } from "react-router-dom";
import { EventLockBadge } from "./EventLockBadge.jsx";
import { eventLockLabel } from "./event-lock.js";

export function LinkedEventLockBanner({ linkedEvent, canUnlockLinkedEvent = false }) {
  if (!linkedEvent?.effectiveLocked) return null;

  return (
    <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-[0.85rem] text-amber-50/90">
      <div className="flex flex-wrap items-center gap-2">
        <EventLockBadge event={linkedEvent} />
        <span>{eventLockLabel(linkedEvent.lockReason)}</span>
      </div>
      <p className="m-0 mt-2 leading-relaxed text-amber-50/80">
        This tool is linked to a locked event and cannot be edited.
        {canUnlockLinkedEvent ? (
          <>
            {" "}
            Unlock the event from the{" "}
            <Link to={`/events/${linkedEvent.id}`} className="text-amber-100 underline">
              Match Brief
            </Link>{" "}
            or calendar if you need to make changes.
          </>
        ) : (
          <> Contact an administrator to unlock the event.</>
        )}
      </p>
    </div>
  );
}
