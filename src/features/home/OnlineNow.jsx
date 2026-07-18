/**
 * Floating avatar bubbles for site presence — right edge of the dashboard.
 */
export function OnlineNow({ peers = [], status, selfName, selfAvatar }) {
  const people = [];
  if (status === "connected" || status === "connecting" || status === "joining") {
    people.push({
      steamId: "__self__",
      name: selfName || "You",
      avatar: selfAvatar || null,
      self: true,
      context: "hub",
      pending: status !== "connected",
    });
  }
  for (const peer of peers) {
    if (!peer?.steamId) continue;
    people.push({ ...peer, self: false, pending: false });
  }

  if (status === "error" || status === "disconnected") {
    return (
      <div
        className="pointer-events-auto fixed right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-2 sm:right-5"
        title={
          status === "error"
            ? "Presence unavailable — check collab join / WebSocket"
            : "Disconnected from presence"
        }
      >
        <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/[0.06]">
          {selfAvatar ? (
            <img src={selfAvatar} alt="" className="h-full w-full object-cover opacity-40" />
          ) : (
            <span className="text-sm text-white/35">
              {(selfName || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#16161a] bg-rose-400" />
        </div>
      </div>
    );
  }

  if (!people.length) {
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
                  ? `${person.name} (you)${person.pending ? " · connecting…" : ""}`
                  : `${person.name || person.steamId}${
                      person.context && person.context !== "hub"
                        ? ` · ${person.context}`
                        : ""
                    }`
              }
            >
              <div
                className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/[0.08] shadow-[0_8px_28px_rgba(0,0,0,0.35)] transition duration-300 group-hover:-translate-y-0.5 group-hover:border-white/35 ${
                  person.pending ? "animate-pulse opacity-70" : ""
                }`}
              >
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
                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#16161a] ${
                  person.pending
                    ? "bg-amber-400"
                    : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.65)]"
                }`}
                aria-label={person.pending ? "Connecting" : "Online"}
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
