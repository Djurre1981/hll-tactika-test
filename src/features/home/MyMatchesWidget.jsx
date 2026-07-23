import { Link } from "react-router-dom";
import { useMemo } from "react";
import { Spinner } from "../../shared/Spinner.jsx";
import { useAuth } from "../auth/AuthGate.jsx";
import { useMatchHistoryQuery } from "../records/hooks/useMatchHistoryQuery.js";
import {
  countParticipantMatches,
  filterMatchHistory,
  formatHistoryEventWhen,
  historyMatchLine,
  historyResultLabel,
} from "../records/match-history-utils.js";

/** Compact hub list of matches where the logged-in Steam ID was on Circle’s side. */
export function MyMatchesWidget() {
  const user = useAuth();
  const steamId = String(user?.steamId || "").trim();
  const historyQuery = useMatchHistoryQuery();

  const mine = useMemo(() => {
    if (!steamId) return [];
    return filterMatchHistory(historyQuery.data || [], { participantSteamId: steamId }).slice(0, 5);
  }, [historyQuery.data, steamId]);

  const total = useMemo(
    () => countParticipantMatches(historyQuery.data || [], steamId),
    [historyQuery.data, steamId]
  );

  if (!steamId) return null;

  return (
    <section className="mb-4 rounded-[1.125rem] border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h3 className="m-0 text-[0.68rem] font-normal uppercase tracking-[0.14em] text-white/50">
          My matches
        </h3>
        <Link
          to="/records"
          className="text-[0.72rem] text-accent no-underline hover:underline"
        >
          {total ? `${total} total` : "History"}
        </Link>
      </div>

      {historyQuery.isLoading ? (
        <div className="flex items-center gap-2 px-1 py-2 text-[0.78rem] text-white/45">
          <Spinner />
          Loading…
        </div>
      ) : !mine.length ? (
        <p className="m-0 px-1 py-2 text-[0.78rem] text-white/40">
          No linked games yet for your Steam ID.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {mine.map((event) => (
            <li key={event.id}>
              <Link
                to={`/events/${event.id}`}
                className="block rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 no-underline transition hover:border-accent/30"
              >
                <p className="m-0 truncate text-[0.85rem] text-white">{event.title}</p>
                <p className="m-0 mt-0.5 text-[0.7rem] text-white/45">
                  {historyResultLabel(event.match?.result)}
                  {historyMatchLine(event) ? ` · ${historyMatchLine(event)}` : ""}
                  {" · "}
                  {formatHistoryEventWhen(event.startsAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
