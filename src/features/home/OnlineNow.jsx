/**
 * Presence bubbles — online (green) + recently signed-in offline (50% opacity, no dot).
 * Positioned by parent under the profile avatar.
 */
export function OnlineNow({
  peers = [],
  members = [],
  status,
  selfSteamId,
  selfName,
  selfAvatar,
}) {
  const selfLive =
    status === "connected" ||
    status === "reconnecting" ||
    status === "connecting" ||
    status === "joining";
  const selfPending = status === "connecting" || status === "joining";

  const onlineBySteam = new Map();
  if (selfLive) {
    onlineBySteam.set(selfSteamId || "__self__", {
      steamId: selfSteamId || "__self__",
      name: selfName || "You",
      avatar: selfAvatar || null,
      self: true,
      online: true,
      pending: selfPending,
    });
  }
  for (const peer of peers) {
    if (!peer?.steamId || String(peer.steamId) === String(selfSteamId || "")) continue;
    onlineBySteam.set(String(peer.steamId), {
      ...peer,
      steamId: String(peer.steamId),
      self: false,
      online: true,
      pending: false,
    });
  }

  const offline = [];
  for (const member of members) {
    if (!member?.steamId || String(member.steamId) === String(selfSteamId || "")) continue;
    if (onlineBySteam.has(String(member.steamId))) continue;
    const last = member.lastSignedInAt;
    if (!last || last === "Never" || last === "unknown" || last === "Unknown") continue;
    offline.push({
      steamId: member.steamId,
      name: member.name || member.steamId,
      avatar: member.avatar || null,
      self: false,
      online: false,
      pending: false,
      lastSignedInAt: last,
    });
  }

  const people = [...onlineBySteam.values(), ...offline];

  if (!people.length && status !== "error") {
    return null;
  }

  if (!people.length && (status === "error" || status === "disconnected")) {
    return (
      <div className="pointer-events-auto" title="Presence reconnecting…">
        <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/[0.06] opacity-50">
          {selfAvatar ? (
            <img src={selfAvatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-white/40">
              {(selfName || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col items-center gap-3 p-0" aria-label="Online now">
      {people.map((person, index) => (
        <li
          key={person.steamId}
          className="pointer-events-auto animate-[hub-shell-enter_0.55s_cubic-bezier(0.22,1,0.36,1)_both]"
          style={{ animationDelay: `${60 + index * 50}ms` }}
        >
          <div
            className="group relative"
            title={
              person.self
                ? `${person.name} (you)${person.pending ? " · connecting…" : ""}`
                : person.online
                  ? `${person.name || person.steamId}${
                      person.context && person.context !== "hub"
                        ? ` · ${person.context}`
                        : ""
                    }`
                  : `${person.name || person.steamId} · last seen`
            }
          >
            <div
              className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/[0.08] shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition duration-300 group-hover:-translate-y-0.5 group-hover:border-white/35 ${
                person.online ? "" : "opacity-50"
              }`}
            >
              {person.avatar ? (
                <img
                  src={person.avatar}
                  alt=""
                  className="h-full w-full object-cover"
                  width={40}
                  height={40}
                />
              ) : (
                <span className="text-xs font-medium text-white/70">
                  {(person.name || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            {person.online ? (
              <span
                className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0a0a0c] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.65)] ${
                  person.pending ? "animate-pulse" : ""
                }`}
                aria-label={person.pending ? "Connecting" : "Online"}
              />
            ) : null}
            <span className="pointer-events-none absolute right-full top-1/2 mr-3 max-w-[9rem] -translate-y-1/2 truncate rounded-lg border border-white/10 bg-[rgba(18,18,22,0.92)] px-2.5 py-1 text-[0.72rem] text-white/80 opacity-0 shadow-lg transition group-hover:opacity-100">
              {person.self ? `${person.name} (you)` : person.name || person.steamId}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
