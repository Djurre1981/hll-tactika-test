function DetailPlaceholder({ title }) {
  return (
    <div className="glass-panel flex min-h-[8.5rem] flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="m-0 text-[0.95rem] font-medium text-white/85">{title}</h3>
        <span className="text-white/35" aria-hidden="true">
          ···
        </span>
      </div>
      <div className="mt-3 flex-1 rounded-2xl border border-dashed border-white/10 bg-white/[0.03]" />
    </div>
  );
}

export function RosterDetailPanel({ member }) {
  if (!member) {
    return (
      <aside className="flex h-full min-h-[16rem] flex-col gap-3">
        <div className="glass-panel flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="m-0 text-[0.95rem] text-white/55">Select a member</p>
          <p className="mt-2 text-[0.8rem] text-white/35">
            Options and details will appear here.
          </p>
        </div>
        <DetailPlaceholder title="Section" />
        <DetailPlaceholder title="Section" />
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-0 flex-col gap-3">
      <div className="glass-panel p-5">
        <p className="m-0 text-[0.72rem] uppercase tracking-wider text-white/40">Selected</p>
        <h3 className="mt-2 m-0 text-[1.25rem] font-medium text-white">{member.displayName}</h3>
        <p className="mt-1 text-[0.85rem] text-white/45">
          {member.steamId ? `#${member.steamId}` : "No Steam ID"}
        </p>
      </div>
      <DetailPlaceholder title="Member options" />
      <DetailPlaceholder title="Assignments" />
      <DetailPlaceholder title="Notes" />
    </aside>
  );
}
