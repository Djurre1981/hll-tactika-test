import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Spinner } from "../../../shared/Spinner.jsx";
import { useOpenPrepTasksQuery } from "../../events/hooks/usePrepTasksQuery.js";
import { useEventRsvpsQuery } from "../../events/hooks/useRsvpsQuery.js";
import { useMatchHistoryQuery } from "../../records/hooks/useMatchHistoryQuery.js";
import { useEventsRangeQuery } from "../../calendar/hooks/useEventsQuery.js";
import {
  useRosterMembersQuery,
  useRostersQuery,
} from "../hooks/useRostersQuery.js";
import { usePlayerStatsAggregatesQuery } from "../hooks/usePlayerStatsQuery.js";
import {
  buildParticipationBoard,
  buildRoleDepth,
  buildSeasonPulse,
  computeEventReadiness,
  formatCountdown,
  formatEventWhen,
  mergeCombatIntoFormBoard,
  readinessClass,
  readinessLabel,
} from "../overview-utils.js";

function Panel({ title, subtitle, children, className = "" }) {
  return (
    <div className={`glass-panel flex flex-col p-5 ${className}`}>
      <h3 className="m-0 text-[1.05rem] font-medium tracking-wide text-white">{title}</h3>
      {subtitle ? <p className="mt-1.5 text-[0.82rem] text-white/45">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function FormBadge({ result }) {
  const isWin = result === "win";
  return (
    <span
      className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border px-1.5 text-[0.68rem] font-medium ${
        isWin
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : "border-red-400/30 bg-red-500/10 text-red-200"
      }`}
    >
      {isWin ? "W" : "L"}
    </span>
  );
}

function UpcomingEventsCard({ events, openTasksByEvent, rsvpCountsByEvent }) {
  if (!events.length) {
    return (
      <p className="m-0 text-[0.85rem] text-white/45">
        No upcoming events.{" "}
        <Link to="/calendar" className="text-sky-200/90 no-underline hover:text-sky-100">
          Open calendar
        </Link>
      </p>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {events.map((event) => {
        const openCount = openTasksByEvent.get(event.id) || 0;
        const rsvpCounts = rsvpCountsByEvent.get(event.id) || null;
        const score = computeEventReadiness(event, {
          openPrepCount: openCount,
          rsvpCounts,
        });
        const matchLine = [
          event.match?.opponent ? `vs ${event.match.opponent}` : null,
          event.match?.mapId || null,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <li key={event.id}>
            <Link
              to={`/events/${event.id}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 no-underline transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="m-0 text-[0.68rem] uppercase tracking-[0.12em] text-white/40">
                    {event.eventType || "Event"}
                    {formatCountdown(event.startsAt) ? ` · ${formatCountdown(event.startsAt)}` : ""}
                  </p>
                  <p className="m-0 mt-1 text-[0.95rem] font-medium text-white">{event.title}</p>
                  <p className="m-0 mt-0.5 text-[0.75rem] text-white/45">
                    {formatEventWhen(event.startsAt)}
                    {matchLine ? ` · ${matchLine}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.1em] ${readinessClass(score)}`}
                  title={`Readiness ${score}%`}
                >
                  {readinessLabel(score)} · {score}%
                </span>
              </div>
              <p className="m-0 mt-2 text-[0.72rem] text-white/40">
                {openCount} open task{openCount === 1 ? "" : "s"}
                {event.match?.crconUrl ? " · CRCON linked" : ""}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function StaffTodoCard({ tasks }) {
  if (!tasks.length) {
    return <p className="m-0 text-[0.85rem] text-white/45">No open staff prep tasks in the next 45 days.</p>;
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {tasks.slice(0, 8).map((task) => (
        <li key={task.id}>
          <Link
            to={`/events/${task.eventId}`}
            className="block rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 no-underline transition hover:border-amber-300/25 hover:bg-black/25"
          >
            <p className="m-0 text-[0.84rem] font-medium text-white">{task.title}</p>
            <p className="m-0 mt-0.5 text-[0.72rem] text-white/45">
              {task.eventTitle}
              {task.eventStartsAt ? ` · ${formatEventWhen(task.eventStartsAt)}` : ""}
            </p>
          </Link>
        </li>
      ))}
      {tasks.length > 8 ? (
        <li className="text-[0.72rem] text-white/35">+{tasks.length - 8} more on match briefs</li>
      ) : null}
    </ul>
  );
}

function OrgaToolsCard({ nextEvent }) {
  const links = [
    { to: "/calendar", label: "Calendar" },
    { to: "/management#roster", label: "Roster" },
    { to: "/management#history", label: "History" },
    { to: "/management#analytics", label: "Analytics" },
    { to: "/records", label: "HLL Records" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[0.78rem] text-white/80 no-underline transition hover:border-white/25 hover:bg-white/[0.1] hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </div>
      {nextEvent ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="m-0 text-[0.68rem] uppercase tracking-[0.12em] text-white/40">Live ops</p>
          <p className="m-0 mt-1 text-[0.84rem] text-white/85">{nextEvent.title}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-[0.78rem]">
            <Link to={`/events/${nextEvent.id}`} className="text-sky-200/90 no-underline hover:text-sky-100">
              Match Brief
            </Link>
            {nextEvent.match?.crconUrl ? (
              <a
                href={nextEvent.match.crconUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent no-underline hover:underline"
                title="Opens Circle CRCON (may need browser challenge)"
              >
                CRCON scoreboard
              </a>
            ) : (
              <span className="text-white/35">No CRCON link on next event</span>
            )}
            {nextEvent.match?.heloUrl ? (
              <a
                href={nextEvent.match.heloUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent no-underline hover:underline"
              >
                HeLO
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="m-0 text-[0.78rem] text-white/40">Link CRCON on Match Brief for live ops.</p>
      )}
    </div>
  );
}

function RankedScrollList({ rows, emptyLabel, valueFn, onSelect }) {
  if (!rows?.length) {
    return <p className="m-0 text-[0.78rem] text-white/40">{emptyLabel}</p>;
  }

  return (
    <ul className="glass-scroll m-0 max-h-[18rem] list-none space-y-0.5 overflow-y-auto overscroll-contain p-0 pr-1">
      {rows.map((row, index) => {
        const content = (
          <>
            <span className="w-5 shrink-0 text-right tabular-nums text-white/35">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate text-white/85">{row.displayName}</span>
            <span className="shrink-0 tabular-nums text-white/45">{valueFn(row)}</span>
          </>
        );

        return (
          <li key={row.steamId}>
            {onSelect ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg border border-transparent px-1 py-1 text-left text-[0.78rem] transition hover:border-white/10 hover:bg-white/[0.04]"
                onClick={() => onSelect(row)}
              >
                {content}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-1 py-1 text-[0.78rem]">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AttendancePulseCard({ nextEvent, rsvpData, participation }) {
  const counts = rsvpData?.counts;
  const hasRsvps = counts && counts.total > 0;
  const rows = (participation?.rows || []).filter((row) => row.gamesPlayed > 0);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {hasRsvps && nextEvent ? (
        <div className="shrink-0">
          <p className="m-0 text-[0.68rem] text-white/45">
            Next:{" "}
            <Link to={`/events/${nextEvent.id}`} className="text-sky-200/90 no-underline hover:text-sky-100">
              {nextEvent.title}
            </Link>
          </p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {[
              ["In", counts.confirmed, "text-emerald-200"],
              ["Maybe", counts.tentative, "text-amber-100"],
              ["Out", counts.declined, "text-red-200"],
              ["N/A", counts.unavailable, "text-white/55"],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
                <p className="m-0 text-[0.58rem] uppercase tracking-[0.1em] text-white/40">{label}</p>
                <p className={`m-0 mt-0.5 text-[1rem] font-medium tabular-nums ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="m-0 shrink-0 text-[0.7rem] text-white/45">
          {nextEvent ? (
            <>
              No RSVPs yet — set attendance on{" "}
              <Link to={`/events/${nextEvent.id}`} className="text-sky-200/90 no-underline hover:text-sky-100">
                next brief
              </Link>
              .
            </>
          ) : (
            <>Played in last {participation?.poolSize || 0} comps.</>
          )}
        </p>
      )}

      <RankedScrollList
        rows={rows}
        emptyLabel="No players with matches yet."
        valueFn={(row) => `${row.gamesPlayed} · ${row.participationRate}%`}
      />
    </div>
  );
}

function PlayerFormBoard({ rows, onSelect }) {
  const list = (rows || []).filter((row) => row.gamesPlayed > 0);

  return (
    <RankedScrollList
      rows={list}
      emptyLabel="No players with matches yet."
      onSelect={onSelect}
      valueFn={(row) =>
        [
          row.winRate != null ? `${row.winRate}%` : null,
          row.kd != null ? `${row.kd} K/D` : null,
          `${row.gamesPlayed}g`,
        ]
          .filter(Boolean)
          .join(" · ")
      }
    />
  );
}

function SeasonPulseCard({ pulse }) {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="m-0 text-[0.62rem] uppercase tracking-[0.12em] text-white/40">Win %</p>
          <p className="m-0 mt-1 text-[1.15rem] font-medium text-white">{pulse.winRateLabel}</p>
        </div>
        <div>
          <p className="m-0 text-[0.62rem] uppercase tracking-[0.12em] text-white/40">Record</p>
          <p className="m-0 mt-1 text-[1.15rem] font-medium text-white">{pulse.recordLabel || "—"}</p>
        </div>
        <div>
          <p className="m-0 text-[0.62rem] uppercase tracking-[0.12em] text-white/40">Form</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(pulse.form || []).length
              ? pulse.form.map((result, index) => (
                  <FormBadge key={`${result}-${index}`} result={result} />
                ))
              : <span className="text-[0.85rem] text-white/45">—</span>}
          </div>
        </div>
      </div>
      <p className="m-0 mt-auto text-[0.72rem] text-white/40">
        {pulse.nextOpponent ? (
          <>
            Next opponent: <span className="text-white/75">{pulse.nextOpponent}</span>
            {pulse.nextEventId ? (
              <>
                {" · "}
                <Link
                  to={`/events/${pulse.nextEventId}`}
                  className="text-sky-200/90 no-underline hover:text-sky-100"
                >
                  Brief
                </Link>
              </>
            ) : null}
          </>
        ) : (
          "No upcoming opponent set"
        )}
        {" · "}
        <Link to="/management#analytics" className="text-sky-200/90 no-underline hover:text-sky-100">
          Analytics
        </Link>
      </p>
    </div>
  );
}

function PlayerProfileDrawer({ player, onClose, roleDepth }) {
  if (!player) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-[1.5rem] border border-white/12 bg-[rgba(18,20,26,0.98)] p-5 shadow-glass">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-white/40">Player profile</p>
            <h4 className="m-0 mt-1 text-[1.2rem] font-medium text-white">{player.displayName}</h4>
            {player.rosterRole ? (
              <p className="m-0 mt-1 text-[0.78rem] text-white/50">{player.rosterRole}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-full border border-white/15 px-3 py-1 text-[0.75rem] text-white/70"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {[
            ["Games played", player.gamesPlayed],
            ["Win rate", player.winRate != null ? `${player.winRate}%` : "—"],
            ["Record", `${player.wins}–${player.losses}`],
            ["Participation", `${player.participationRate}%`],
            ["Kills", player.kills ?? "—"],
            ["K/D", player.kd ?? "—"],
            ["Combat pts", player.combatPoints ?? "—"],
            ["Matches w/ stats", player.matchesWithStats ?? "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <dt className="text-[0.62rem] uppercase tracking-[0.12em] text-white/40">{label}</dt>
              <dd className="m-0 mt-1 text-[0.95rem] text-white">{value}</dd>
            </div>
          ))}
        </dl>
        {roleDepth?.length ? (
          <div className="mt-4">
            <p className="m-0 text-[0.68rem] uppercase tracking-[0.12em] text-white/40">Squad role depth</p>
            <p className="m-0 mt-1.5 text-[0.78rem] text-white/55">
              {roleDepth
                .slice(0, 6)
                .map((row) => `${row.role.replace(/_/g, " ")} (${row.count})`)
                .join(" · ")}
            </p>
          </div>
        ) : null}
        <p className="m-0 mt-4 text-[0.72rem] text-white/35">
          Steam {player.steamId}
        </p>
      </div>
    </div>
  );
}

export function OverviewSection() {
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const range = useMemo(() => {
    const now = new Date();
    const toDate = new Date(now);
    toDate.setUTCDate(toDate.getUTCDate() + 45);
    return { from: now.toISOString(), to: toDate.toISOString() };
  }, []);

  const upcomingRange = useEventsRangeQuery({ from: range.from, to: range.to });
  const historyQuery = useMatchHistoryQuery();
  const openTasksQuery = useOpenPrepTasksQuery(range);
  const rostersQuery = useRostersQuery();

  const defaultRosterId = useMemo(() => {
    const list = rostersQuery.data?.rosters || [];
    const preferred =
      list.find((r) => r.id === "roster-default") ||
      list.find((r) => !r.isTemplate) ||
      list[0];
    return preferred?.id || null;
  }, [rostersQuery.data]);

  const membersQuery = useRosterMembersQuery(defaultRosterId);
  const events = useMemo(() => {
    const list = [...(upcomingRange.data?.events || [])];
    list.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return list.slice(0, 6);
  }, [upcomingRange.data]);
  const nextEvent = events[0] || null;
  const nextRsvpQuery = useEventRsvpsQuery(nextEvent?.id, Boolean(nextEvent?.id));

  const members = membersQuery.data?.members || [];
  const steamIds = useMemo(
    () => members.map((m) => m.steamId).filter(Boolean),
    [members]
  );
  const combatQuery = usePlayerStatsAggregatesQuery(steamIds, steamIds.length > 0);

  const openTasks = openTasksQuery.data || [];
  const openTasksByEvent = useMemo(() => {
    const map = new Map();
    for (const task of openTasks) {
      map.set(task.eventId, (map.get(task.eventId) || 0) + 1);
    }
    return map;
  }, [openTasks]);

  const rsvpCountsByEvent = useMemo(() => {
    const map = new Map();
    if (nextEvent?.id && nextRsvpQuery.data?.counts) {
      map.set(nextEvent.id, nextRsvpQuery.data.counts);
    }
    return map;
  }, [nextEvent?.id, nextRsvpQuery.data]);

  const participation = useMemo(
    () => buildParticipationBoard(historyQuery.data || [], members),
    [historyQuery.data, members]
  );

  const formRows = useMemo(() => {
    const merged = mergeCombatIntoFormBoard(participation.rows, combatQuery.data || {});
    return [...merged]
      .filter((row) => row.gamesPlayed > 0)
      .sort((a, b) => {
        if ((b.winRate ?? -1) !== (a.winRate ?? -1)) return (b.winRate ?? -1) - (a.winRate ?? -1);
        return b.gamesPlayed - a.gamesPlayed;
      });
  }, [participation.rows, combatQuery.data]);

  const seasonPulse = useMemo(
    () => buildSeasonPulse(historyQuery.data || [], events),
    [historyQuery.data, events]
  );

  const roleDepth = useMemo(() => buildRoleDepth(members), [members]);

  const loading =
    upcomingRange.isLoading ||
    historyQuery.isLoading ||
    openTasksQuery.isLoading ||
    (defaultRosterId && membersQuery.isLoading);

  return (
    <section className="glass-scroll flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain pr-1">
      <header className="shrink-0 pb-4">
        <h2 className="m-0 text-[1.65rem] font-medium tracking-wide text-white">Overview</h2>
        <p className="mt-1.5 text-[0.9rem] text-white/50">
          Management hub — upcoming events, tasks, and org tools.
        </p>
      </header>

      {loading ? (
        <div className="mb-4 flex shrink-0 items-center gap-3 text-white/55">
          <Spinner />
          <span className="text-[0.85rem]">Loading management pulse…</span>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-col gap-4 pb-2">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel
            title="Upcoming events"
            subtitle="Tournament matches and clan events — readiness from tools, tasks, and RSVPs."
          >
            <UpcomingEventsCard
              events={events}
              openTasksByEvent={openTasksByEvent}
              rsvpCountsByEvent={rsvpCountsByEvent}
            />
          </Panel>

          <div className="flex flex-col gap-4">
            <Panel title="To-do list" subtitle="Staff prep tasks across upcoming events.">
              <StaffTodoCard tasks={openTasks} />
            </Panel>
            <Panel title="Orga tools" subtitle="Quick links and live ops for the next match.">
              <OrgaToolsCard nextEvent={nextEvent} />
            </Panel>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="glass-surface flex min-h-0 flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <h3 className="m-0 text-[0.88rem] font-medium text-white">Attendance pulse</h3>
            <p className="m-0 mt-1 text-[0.7rem] text-white/40">
              Ranked by comps played · scroll for full list
            </p>
            <div className="mt-3 min-h-0">
              <AttendancePulseCard
                nextEvent={nextEvent}
                rsvpData={nextRsvpQuery.data}
                participation={participation}
              />
            </div>
          </div>

          <div className="glass-surface flex min-h-0 flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <h3 className="m-0 text-[0.88rem] font-medium text-white">Player form</h3>
            <p className="m-0 mt-1 text-[0.7rem] text-white/40">
              Ranked by win rate · click for profile
            </p>
            <div className="mt-3 min-h-0">
              <PlayerFormBoard rows={formRows} onSelect={setSelectedPlayer} />
            </div>
          </div>

          <div className="glass-surface flex flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <h3 className="m-0 text-[0.88rem] font-medium text-white">Season pulse</h3>
            <div className="mt-3">
              <SeasonPulseCard pulse={seasonPulse} />
            </div>
          </div>
        </div>

        {roleDepth.length ? (
          <p className="m-0 shrink-0 text-[0.75rem] text-white/35">
            Depth chart:{" "}
            {roleDepth
              .slice(0, 8)
              .map((row) => `${row.role.replace(/_/g, " ")} ×${row.count}`)
              .join(" · ")}
          </p>
        ) : null}
      </div>

      <PlayerProfileDrawer
        player={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        roleDepth={roleDepth}
      />
    </section>
  );
}
