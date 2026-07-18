/**
 * Small avatar stack of remote collab peers.
 */
export function CollabPeers({ peers = [], status }) {
  if (!peers.length && status !== "connected" && status !== "connecting" && status !== "joining") {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5" title="People in this room">
      {status && status !== "connected" ? (
        <span className="text-[0.65rem] uppercase tracking-wider text-white/35">
          {status === "joining" || status === "connecting" ? "sync…" : status}
        </span>
      ) : null}
      <div className="flex -space-x-2">
        {peers.slice(0, 6).map((peer) => (
          <div
            key={peer.steamId}
            className="flex h-8 w-8 overflow-hidden rounded-full border border-white/20 bg-white/10"
            title={peer.name || peer.steamId}
          >
            {peer.avatar ? (
              <img
                src={peer.avatar}
                alt=""
                className="h-full w-full object-cover"
                width={32}
                height={32}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[0.65rem] text-white/70">
                {(peer.name || "?").slice(0, 1)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
