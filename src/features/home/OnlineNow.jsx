/**
 * Compact “online now” list for the dashboard.
 */
export function OnlineNow({ peers = [], status, selfName }) {
  const count = peers.length + (status === "connected" ? 1 : 0);

  return (
    <div aria-labelledby="online-now-title">
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <h3
          className="m-0 text-[0.72rem] font-normal uppercase tracking-[0.16em] text-white/50"
          id="online-now-title"
        >
          Online now
        </h3>
        <span className="text-[0.7rem] text-white/35">
          {status === "connected" ? count : status === "error" ? "offline" : "…"}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {status === "connected" ? (
          <li className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-[0.85rem] text-white/80">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400/80" aria-hidden />
            {selfName || "You"}
            <span className="text-white/35">(you)</span>
          </li>
        ) : null}
        {peers.map((peer) => (
          <li
            key={peer.steamId}
            className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-[0.85rem] text-white/75"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400/60" aria-hidden />
            {peer.avatar ? (
              <img
                src={peer.avatar}
                alt=""
                className="h-6 w-6 rounded-full object-cover"
                width={24}
                height={24}
              />
            ) : null}
            <span className="min-w-0 truncate">{peer.name || peer.steamId}</span>
            {peer.context && peer.context !== "hub" ? (
              <span className="ml-auto shrink-0 text-[0.65rem] uppercase tracking-wide text-white/30">
                {peer.context}
              </span>
            ) : null}
          </li>
        ))}
        {status === "connected" && peers.length === 0 ? (
          <li className="px-1 text-[0.8rem] text-white/35">Just you right now</li>
        ) : null}
        {status === "error" ? (
          <li className="px-1 text-[0.8rem] text-white/40">
            Presence unavailable (collab server)
          </li>
        ) : null}
      </ul>
    </div>
  );
}
