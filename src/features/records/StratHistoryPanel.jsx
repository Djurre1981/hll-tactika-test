import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Spinner } from "../../shared/Spinner.jsx";
import { GlassSelect } from "../../shared/GlassSelect.jsx";
import { useStratsMetaQuery } from "../strats/browser/hooks/useStratsBrowserQuery.js";
import {
  filterStratHistory,
  formatStratHistoryWhen,
  stratHistoryLine,
  stratHistoryResultClass,
  stratHistoryResultLabel,
  stratHistoryTeamLabel,
  stratHistoryTypeLabel,
  stratTeamId,
  summarizeStratHistory,
  uniqueStratMapIds,
  uniqueStratStrongpoints,
  STRAT_HISTORY_SORT_OPTIONS,
} from "./strat-history-utils.js";

function StatChip({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="m-0 text-[0.65rem] uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="m-0 mt-1 text-[1.15rem] font-medium text-white">{value}</p>
    </div>
  );
}

const FILTER_INPUT =
  "w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[0.88rem] text-white outline-none transition focus:border-accent/40";

export function StratHistoryPanel({ compact = false }) {
  const stratsQuery = useStratsMetaQuery();
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [mapFilter, setMapFilter] = useState("");
  const [factionFilter, setFactionFilter] = useState("");
  const [strongpointFilter, setStrongpointFilter] = useState("");
  const [sort, setSort] = useState("date_desc");

  const allStrats = stratsQuery.data?.strats || [];

  const filters = useMemo(
    () => ({
      query: query || undefined,
      team: teamFilter || undefined,
      stratType: typeFilter || undefined,
      result: resultFilter || undefined,
      mapId: mapFilter || undefined,
      faction: factionFilter || undefined,
      startingPoint: strongpointFilter || undefined,
      sort,
    }),
    [
      query,
      teamFilter,
      typeFilter,
      resultFilter,
      mapFilter,
      factionFilter,
      strongpointFilter,
      sort,
    ]
  );

  const filtered = useMemo(
    () => filterStratHistory(allStrats, filters),
    [allStrats, filters]
  );

  const stats = useMemo(() => summarizeStratHistory(allStrats), [allStrats]);

  const mapOptions = useMemo(
    () => uniqueStratMapIds(allStrats).map((mapId) => ({ value: mapId, label: mapId })),
    [allStrats]
  );

  const strongpointOptions = useMemo(
    () => uniqueStratStrongpoints(allStrats),
    [allStrats]
  );

  if (stratsQuery.isLoading) {
    return (
      <div className="flex items-center gap-3 text-white/55">
        <Spinner />
        <span>Loading strat history…</span>
      </div>
    );
  }

  if (stratsQuery.error) {
    return (
      <p className="m-0 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
        {stratsQuery.error.message || "Could not load strat history."}
      </p>
    );
  }

  return (
    <div className={`flex min-h-0 flex-col gap-4 ${compact ? "" : "flex-1"}`}>
      {!compact ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatChip label="Strats" value={stats.entries} />
          <StatChip label="With match meta" value={stats.withMeta} />
          <StatChip label="With result" value={stats.recorded} />
          <StatChip
            label="Win rate"
            value={stats.winRate == null ? "—" : `${stats.winRate}%`}
          />
        </div>
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/15 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <label className="block min-w-0 sm:col-span-2 xl:col-span-2">
          <span className="mb-1.5 block text-[0.68rem] uppercase tracking-[0.12em] text-white/40">
            Search
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title, opponent, map…"
            className={FILTER_INPUT}
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[0.68rem] uppercase tracking-[0.12em] text-white/40">
            Sort
          </span>
          <GlassSelect
            value={sort}
            onChange={setSort}
            placeholder=""
            options={STRAT_HISTORY_SORT_OPTIONS}
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[0.68rem] uppercase tracking-[0.12em] text-white/40">
            Team
          </span>
          <GlassSelect
            value={teamFilter}
            onChange={setTeamFilter}
            placeholder="All teams"
            options={[
              { value: "jr", label: "JR" },
              { value: "sr", label: "SR" },
            ]}
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
              { value: "friendly", label: "Friendly" },
              { value: "tournament", label: "Tournament" },
            ]}
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
            Faction
          </span>
          <GlassSelect
            value={factionFilter}
            onChange={setFactionFilter}
            placeholder="All factions"
            options={[
              { value: "axis", label: "Axis" },
              { value: "allies", label: "Allies" },
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
            Strongpoint
          </span>
          <GlassSelect
            value={strongpointFilter}
            onChange={setStrongpointFilter}
            placeholder="All strongpoints"
            options={strongpointOptions}
          />
        </label>
      </div>

      <p className="m-0 text-[0.72rem] text-white/40">
        Showing {filtered.length} of {allStrats.length} strat{allStrats.length === 1 ? "" : "s"}
      </p>

      {!filtered.length ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-5 py-10 text-center">
          <p className="m-0 text-[0.95rem] text-white/70">No strats match these filters</p>
          <p className="m-0 mt-2 text-[0.82rem] text-white/40">
            Try clearing search or filters, or add match details on a strat in Stratmaker.
          </p>
        </div>
      ) : (
        <ul
          className={`m-0 flex list-none flex-col gap-2 p-0 ${
            compact ? "" : "glass-scroll min-h-0 flex-1 overflow-y-auto pr-1"
          }`}
        >
          {filtered.map((strat) => {
            const result = strat.match?.result || "";
            const team = stratTeamId(strat);
            const matchLine = stratHistoryLine(strat);
            const slideCount = strat.slideCount;
            return (
              <li key={strat.id}>
                <Link
                  to={`/strats/${strat.id}`}
                  className="block rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3.5 no-underline transition hover:border-accent/35 hover:bg-white/[0.05]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {team ? (
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-white/45">
                            {stratHistoryTeamLabel(team)}
                          </span>
                        ) : null}
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-white/45">
                          {stratHistoryTypeLabel(strat.tags?.type)}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] ${stratHistoryResultClass(result)}`}
                        >
                          {stratHistoryResultLabel(result)}
                        </span>
                        {slideCount != null ? (
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-white/40">
                            {slideCount} slide{slideCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                      <p className="m-0 mt-2 truncate text-[0.98rem] font-medium text-white">
                        {strat.title || "Untitled strat"}
                      </p>
                      {matchLine ? (
                        <p className="m-0 mt-1 text-[0.82rem] text-white/55">{matchLine}</p>
                      ) : (
                        <p className="m-0 mt-1 text-[0.82rem] text-white/40">
                          No match details set
                        </p>
                      )}
                      <p className="m-0 mt-1.5 text-[0.72rem] text-white/40">
                        {formatStratHistoryWhen(strat)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[0.78rem] text-white/90">
                      Open strat
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
