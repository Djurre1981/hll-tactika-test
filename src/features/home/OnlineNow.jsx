/**
 * Floating avatar bubbles for site presence — right edge of the dashboard.
 */
export function OnlineNow({ peers = [], status, selfName, selfAvatar }) {
  const people = [];
  if (status === "connected") {
    people.push({
      steamId: "__self__",
      name: selfName || "You",
      avatar: selfAvatar || null,
      self: true,
      context: "hub",
    });
  }
  for (const peer of peers) {
    if (!peer?.steamId) continue;
    people.push({ ...peer, self: false });
  }

  if (status === "error") {
    return (
      <div
        className="pointer-events-auto fixed right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-2 sm:right-5"
        title="Presence unavailable"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[0.65rem] text-white/40">
          —
        </div>
      </div>
    );
  }

  if (!people.length && status !== "connecting" && status !== "joining") {
    return null;
  }

  return (
    <aside
      className="pointer-events-none fixed right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-3 sm:right-5"
      aria-label="Online now"
    >
      <p className="pointer-events-none m-0 rotate-180 text-[0.62rem] uppercase tracking-[0.18em] text-white/30 [writing-mode:vertical-rl]">
        Online
      </p>
      <ul className="m-0 flex list-none flex-col items-center gap-3 p-0">
        {status === "joining" || status === "connecting" ? (
          <li className="pointer-events-auto">
            <div className="h-11 w-11 animate-pulse rounded-full border border-white/15 bg-white/[0.08]" />
          </li>
        ) : null}
        {people.map((person, index) => (
          <li
            key={person.steamId}
            className="pointer-events-auto animate-[hub-shell-enter_0.55s_cubic-bezier(0.22,1,0.36,1)_both]"
            style={{ animationDelay: `${80 + index * 60}ms` }}
          >
            <div
              className="group relative"
              title={
                person.self
                  ? `${person.name} (you)`
                  : `${person.name || person.steamId}${
                      person.context && person.context !== "hub"
                        ? ` · ${person.context}`
                        : ""
                    }`
              }
            >
              <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/[0.08] shadow-[0_8px_28px_rgba(0,0,0,0.35)] transition duration-300 group-hover:-translate-y-0.5 group-hover:border-white/35 group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
                {person.avatar ? (
                  <img
                    src={person.avatar}
                    alt=""
                    className="h-full w-full object-cover"
                    width={48}
                    height={48}
                  />
                ) : (
                  <span className="text-sm font-medium text-white/70">
                    {(person.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <span
                className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#16161a] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.65)]"
                aria-label="Online"
              />
              <span className="pointer-events-none absolute right-full top-1/2 mr-3 max-w-[9rem] -translate-y-1/2 truncate rounded-lg border border-white/10 bg-[rgba(18,18,22,0.92)] px-2.5 py-1 text-[0.72rem] text-white/80 opacity-0 shadow-lg transition group-hover:opacity-100">
                {person.self ? `${person.name} (you)` : person.name || person.steamId}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
