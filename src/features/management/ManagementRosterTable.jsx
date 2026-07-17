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

export function ManagementRosterTable({ members, onRemove, actionPending = false }) {
  if (members.length === 0) {
    return <p className="my-8 text-[0.92rem] text-white/45">No roster members yet.</p>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="px-2.5 py-2 text-left text-[0.72rem] font-normal uppercase tracking-wider text-white/40">
              Name
            </th>
            <th className="px-2.5 py-2 text-left text-[0.72rem] font-normal uppercase tracking-wider text-white/40">
              Role
            </th>
            <th className="px-2.5 py-2 text-left text-[0.72rem] font-normal uppercase tracking-wider text-white/40">
              Status
            </th>
            <th className="px-2.5 py-2" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td className="border-t border-white/[0.06] px-2.5 py-4 align-middle">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-white/12 bg-white/[0.08] text-[0.72rem] font-medium tracking-wide text-white/80"
                    aria-hidden="true"
                  >
                    {member.avatarUrl ? (
                      <img className="h-full w-full object-cover" src={member.avatarUrl} alt="" />
                    ) : (
                      initials(member.displayName)
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[0.95rem] text-white">{member.displayName}</span>
                    <span className="text-[0.78rem] text-white/40">
                      {member.steamId ? `#${member.steamId}` : "No Steam ID"}
                    </span>
                  </span>
                </div>
              </td>
              <td className="border-t border-white/[0.06] px-2.5 py-4 align-middle">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 text-[0.78rem] text-white/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/45" />
                  {ROLE_LABELS[member.rosterRole] || "—"}
                </span>
              </td>
              <td className="border-t border-white/[0.06] px-2.5 py-4 align-middle">
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
              </td>
              <td className="border-t border-white/[0.06] px-2.5 py-4 text-right align-middle">
                <button
                  type="button"
                  className="border-0 bg-transparent px-2 py-1.5 text-[0.78rem] tracking-wider text-white/55 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={actionPending}
                  aria-label={`Remove ${member.displayName}`}
                  onClick={() => onRemove(member)}
                >
                  ···
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { ROLE_LABELS, STATUS_LABELS };
