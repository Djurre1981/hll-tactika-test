const STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
  trial: "Trial",
};

const ROLE_LABELS = {
  commander: "Commander",
  sl: "SL",
  member: "Member",
  reserve: "Reserve",
  coach: "Coach",
};

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function RosterMemberList({
  members,
  selectedId,
  onSelect,
  onRemove,
  actionPending = false,
}) {
  if (members.length === 0) {
    return <p className="my-8 text-center text-[0.92rem] text-white/45">No members in this roster yet.</p>;
  }

  return (
    <div className="overflow-auto">
      <div className="mb-2 hidden grid-cols-[minmax(0,1.6fr)_0.9fr_0.7fr_2rem] gap-3 px-3 text-[0.72rem] font-normal uppercase tracking-wider text-white/40 sm:grid">
        <span>Name</span>
        <span>Role</span>
        <span>Status</span>
        <span aria-hidden="true" />
      </div>
      <ul className="m-0 list-none p-0">
        {members.map((member) => {
          const selected = member.id === selectedId;
          return (
            <li key={member.id}>
              <div
                role="button"
                tabIndex={0}
                className={[
                  "grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-transparent px-3 py-3.5 text-left transition sm:grid-cols-[minmax(0,1.6fr)_0.9fr_0.7fr_2rem]",
                  selected
                    ? "border-white/12 bg-white/[0.08]"
                    : "hover:bg-white/[0.04]",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onSelect(member)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(member);
                  }
                }}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/12 bg-white/[0.08] text-[0.72rem] font-medium tracking-wide text-white/80"
                    aria-hidden="true"
                  >
                    {member.avatarUrl ? (
                      <img className="h-full w-full object-cover" src={member.avatarUrl} alt="" />
                    ) : (
                      initials(member.displayName)
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[0.95rem] font-medium text-white">
                      {member.displayName}
                    </span>
                    <span className="truncate text-[0.78rem] text-white/40">
                      {member.steamId ? `#${member.steamId}` : "No Steam ID"}
                    </span>
                  </span>
                </span>

                <span className="hidden sm:inline-flex">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 text-[0.78rem] text-white/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/45" />
                    {ROLE_LABELS[member.rosterRole] || "—"}
                  </span>
                </span>

                <span className="hidden sm:inline-flex">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.78rem] ${
                      member.status === "active"
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-white/[0.08] text-white/80"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        member.status === "active" ? "bg-emerald-400" : "bg-white/45"
                      }`}
                    />
                    {STATUS_LABELS[member.status] || member.status}
                  </span>
                </span>

                <button
                  type="button"
                  className="justify-self-end border-0 bg-transparent px-1 text-white/45 transition hover:text-white disabled:opacity-45"
                  disabled={actionPending}
                  aria-label={`Remove ${member.displayName}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove?.(member);
                  }}
                >
                  ···
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { ROLE_LABELS, STATUS_LABELS };
