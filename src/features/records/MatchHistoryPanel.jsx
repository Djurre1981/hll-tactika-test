import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Spinner } from "../../shared/Spinner.jsx";
import { GlassSelect } from "../../shared/GlassSelect.jsx";
import { useAuth } from "../auth/AuthGate.jsx";
import { useMatchHistoryQuery } from "./hooks/useMatchHistoryQuery.js";
import { COMP_TEAMS } from "../../../functions/lib/comp-teams.js";
import {
  countParticipantMatches,
  eventHasParticipant,
  filterMatchHistory,
  formatHistoryEventWhen,
  hasRecordedResult,
  historyEventTypeLabel,
  historyMatchLine,
  historyResultClass,
  historyResultLabel,
  historyTeamLabel,
  summarizeMatchHistory,
  uniqueMapIds,
} from "./match-history-utils.js";

function StatChip({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="m-0 text-[0.65rem] uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="m-0 mt-1 text-[1.15rem] font-medium text-white">{value}</p>
    </div>
  );
}

export function MatchHistoryPanel({ compact = false, defaultMineOnly = false }) {
  const user = useAuth();
  const mySteamId = String(user?.steamId || "").trim();
  const historyQuery = useMatchHistoryQuery();
  const [resultFilter, setResultFilter] = useState("");
  const [mapFilter, setMapFilter] = useState("");
  const [opponentFilter, setOpponentFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [mineOnly, setMineOnly] = useState(Boolean(defaultMineOnly && mySteamId));

  const allEvents = historyQuery.data || [];

  const filters = useMemo(
    () => ({
      result: resultFilter || undefined,
      mapId: mapFilter || undefined,
      opponent: opponentFilter || undefined,
      eventType: typeFilter || undefined,
      team: teamFilter || undefined,
      participantSteamId: mineOnly && mySteamId ? mySteamId : undefined,
    }),
    [resultFilter, mapFilter, opponentFilter, typeFilter, teamFilter, mineOnly, mySteamId]
  );

  const filtered = useMemo(
    () => filterMatchHistory(allEvents, filters),
    [allEvents, filters]
  );

  const stats = useMemo(() => {
    if (mineOnly && mySteamId) {
      return summarizeMatchHistory(
        filterMatchHistory(allEvents, { participantSteamId: mySteamId })
      );
    }
    return summarizeMatchHistory(allEvents);
  }, [allEvents, mineOnly, mySteamId]);

  const myMatchCount = useMemo(
    () => countParticipantMatches(allEvents, mySteamId),
    [allEvents, mySteamId]
  );

  const mapOptions = useMemo(
    () => uniqueMapIds(allEvents).map((mapId) => ({ value: mapId, label: mapId })),
    [allEvents]
  );

  if (historyQuery.isLoading) {
    return (
      <div className="flex items-center gap-3 text-white/55">
        <Spinner />
        <span>Loading match history…</span>
      </div>
    );
  }

  if (historyQuery.error) {
    return (
      <p className="m-0 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
        {historyQuery.error.message || "Could not load match history."}
      </p>
    );
  }

  return (
    <div className={`flex min-h-0 flex-col gap-4 ${compact ? "" : "flex-1"}`}>
      {!compact ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatChip label="Past matches" value={stats.entries} />
          <StatChip label="With result" value={stats.recorded} />
          <StatChip label="Wins" value={stats.wins} />
          <StatChip
            label="Win rate"
            value={stats.winRate == null ? "—" : `${stats.winRate}%`}
          />
        </div>
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/15 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {mySteamId ? (
          <label className="flex min-w-0 cursor-pointer items-end gap-2 pb-2 sm:col-span-2 lg:col-span-1">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent,#7dd3fc)]"
              checked={mineOnly}
              onChange={(event) => setMineOnly(event.target.checked)}
            />
            <span className="text-[0.82rem] text-white/75">
              My matches
              <span className="mt-0.5 block text-[0.65rem] uppercase tracking-[0.12em] text-white/40">
                {myMatchCount} linked
              </span>
            </span>
          </label>
        ) : null}
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[0.68rem] uppercase tracking-[0.12em] text-white/40">
            Team
          </span>
          <GlassSelect
            value={teamFilter}
            onChange={setTeamFilter}
            placeholder="All teams"
            options={COMP_TEAMS.map((team) => ({ value: team.id, label: team.label }))}
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[0.68rem] uppercase tracking-[0.12em] text-white/40">
            Result
          </span>
          <GlassSelect
            value={resultFilter}
            onChange={setResultFilter}
            placeholder="All results"
            options={[
              { value: "win", label: "Win" },
              { value: "loss", label: "Loss" },
            ]}
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[0.68rem] uppercase tracking-[0.12em] text-white/40">
            Map
          </span>
          <GlassSelect
            value={mapFilter}
            onChange={setMapFilter}
            placeholder="All maps"
            options={mapOptions}
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[0.68rem] uppercase tracking-[0.12em] text-white/40">
            Type
          </span>
          <GlassSelect
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="All types"
            options={[
              { value: "scrim", label: "Scrim" },
              { value: "comp", label: "Comp" },
              { value: "practice", label: "Practice" },
            ]}
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[0.68rem] uppercase tracking-[0.12em] text-white/40">
            Opponent
          </span>
          <input
            type="search"
            value={opponentFilter}
            onChange={(event) => setOpponentFilter(event.target.value)}
            placeholder="Search opponent…"
            className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[0.88rem] text-white outline-none transition focus:border-accent/40"
          />
        </label>
      </div>

      {!filtered.length ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-5 py-10 text-center">
          <p className="m-0 text-[0.95rem] text-white/70">
            {mineOnly ? "No matches linked to your Steam ID yet" : "No past matches found"}
          </p>
          <p className="m-0 mt-2 text-[0.82rem] text-white/40">
            {mineOnly
              ? "Participation is matched from HeLO/CRCON scoreboards when your Steam ID was on Circle’s side."
              : "Schedule scrims on the calendar and record results on the event to build history."}
          </p>
        </div>
      ) : (
        <ul className={`m-0 flex list-none flex-col gap-2 p-0 ${compact ? "" : "glass-scroll min-h-0 flex-1 overflow-y-auto pr-1"}`}>
          {filtered.map((event) => {
            const result = event.match?.result || "";
            const matchLine = historyMatchLine(event);
            const youPlayed = eventHasParticipant(event, mySteamId);
            return (
              <li key={event.id}>
                <Link
                  to={`/events/${event.id}`}
                  className="block rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3.5 no-underline transition hover:border-accent/35 hover:bg-white/[0.05]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-white/45">
                          {historyTeamLabel(event.match?.team)}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-white/45">
                          {historyEventTypeLabel(event.eventType)}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] ${historyResultClass(result)}`}
                        >
                          {historyResultLabel(result)}
                        </span>
                        {youPlayed ? (
                          <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-sky-100">
                            You played
                          </span>
                        ) : null}
                      </div>
                      <p className="m-0 mt-2 truncate text-[0.98rem] font-medium text-white">
                        {event.title}
                      </p>
                      {matchLine ? (
                        <p className="m-0 mt-1 text-[0.82rem] text-white/55">{matchLine}</p>
                      ) : null}
                      <p className="m-0 mt-1.5 text-[0.72rem] text-white/40">
                        {formatHistoryEventWhen(event.startsAt)}
                        {!hasRecordedResult(event) ? " · Result not recorded" : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[0.78rem] text-white/90">
                      Open brief
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function RecordsPage() {
  return (
    <div className="glass-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
      <header className="space-y-2">
        <p className="m-0 text-[0.68rem] uppercase tracking-[0.18em] text-accent">HLL Records</p>
        <h1 className="m-0 text-[clamp(1.45rem,2.4vw,2rem)] font-medium tracking-wide text-white">
          Match history
        </h1>
        <p className="m-0 max-w-2xl text-[0.88rem] leading-relaxed text-white/55">
          Browse past scrims and comps, filter by map or opponent, and open the Match Brief for
          linked strats, routes, and prep. Use <span className="text-white/75">My matches</span> to
          see games where your Steam ID was on Circle’s side (from HeLO/CRCON scoreboards).
        </p>
      </header>
      <MatchHistoryPanel />
    </div>
  );
}
