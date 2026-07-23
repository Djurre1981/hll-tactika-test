import { EventLockIcon } from "./EventLockBadge.jsx";

export function ToolLockBadge({ locked, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.68rem] uppercase tracking-[0.1em] ${
        locked
          ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
          : "border-white/10 bg-white/[0.04] text-white/45"
      } ${className}`}
    >
      <EventLockIcon locked={locked} className="text-[0.62rem]" />
      <span>{locked ? "Locked" : "Unlocked"}</span>
    </span>
  );
}

export function ToolLockControl({
  locked = false,
  canManage = false,
  pending = false,
  onLock,
  onUnlock,
  className = "",
}) {
  if (!canManage && !locked) return null;

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.03] px-[0.65rem] py-[0.55rem] ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToolLockBadge locked={locked} />
        {canManage ? (
          <button
            type="button"
            disabled={pending}
            onClick={locked ? onUnlock : onLock}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[0.72rem] text-white/85 transition hover:border-white/25 hover:bg-white/10 disabled:opacity-50"
          >
            <EventLockIcon locked={locked ? false : true} className="text-[0.62rem]" />
            {locked ? "Unlock" : "Lock"}
          </button>
        ) : null}
      </div>
      {locked ? (
        <p className="m-0 mt-2 text-[0.72rem] leading-snug text-white/45">
          {canManage
            ? "This tool is locked. Unlock to edit."
            : "This tool is locked by its creator or an admin."}
        </p>
      ) : null}
    </div>
  );
}
