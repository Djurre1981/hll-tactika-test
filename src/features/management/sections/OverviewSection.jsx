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
  applyRankFilter,
  buildParticipationBoard,
  buildRoleDepth,
  buildSeasonPulse,
  computeEventReadiness,
  filterEventsByPeriod,
  formatCountdown,
  formatEventWhen,
  mergeCombatIntoFormBoard,
  PULSE_PERIODS,
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

function UpcomingEventsCard({ events, openTasksByEvent, rsvpCountsByEvent, rsvpSeatsByEvent }) {
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
        const seats = rsvpSeatsByEvent?.get(event.id) || null;
        const score = computeEventReadiness(event, {
          openPrepCount: openCount,
          rsvpCounts,
          seats,
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
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.1em] ${readinessClass(score)}`}
                    title={`Readiness ${score}%`}
                  >
                    {readinessLabel(score)} · {score}%
                  </span>
                  {seats?.lookingForFills ? (
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.08em] text-amber-100">
                      Fills needed
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="m-0 mt-2 text-[0.72rem] text-white/40">
                {openCount} open task{openCount === 1 ? "" : "s"}
                {seats?.target != null ? ` · ${seats.confirmed}/${seats.target} seats` : ""}
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

function PeriodSelector({ value, onChange }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-black/20 p-0.5" role="group" aria-label="Period">
      {PULSE_PERIODS.map((period) => {
        const active = value === period.id;
        return (
          <button
            key={period.id}
            type="button"
            title={period.label}
            className={[
              "rounded-full px-2.5 py-1 text-[0.68rem] transition",
              active
                ? "bg-white/15 text-white"
                : "text-white/45 hover:bg-white/[0.06] hover:text-white/75",
            ].join(" ")}
            aria-pressed={active}
            onClick={() => onChange?.(period.id)}
          >
            {period.shortLabel}
          </button>
        );
      })}
    </div>
  );
}

function RankToggle({ value, onChange }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-black/20 p-0.5" role="group" aria-label="Best or worst">
      <button
        type="button"
        title="Best"
        aria-label="Best"
        aria-pressed={value === "best"}
        className={[
          "grid h-7 w-7 place-items-center rounded-full transition",
          value === "best"
            ? "bg-emerald-400/20 text-emerald-300"
            : "text-white/35 hover:bg-white/[0.06] hover:text-emerald-200/80",
        ].join(" ")}
        onClick={() => onChange?.("best")}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M7 11v9H4.5A1.5 1.5 0 0 1 3 18.5V13a2 2 0 0 1 2-2h2Zm0 0V8.2C7 5.9 8.8 4 11.2 4c.9 0 1.6.7 1.6 1.6V9h4.7c1.5 0 2.6 1.4 2.3 2.8l-1.3 6A2.3 2.3 0 0 1 16.3 20H7"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        title="Worst"
        aria-label="Worst"
        aria-pressed={value === "worst"}
        className={[
          "grid h-7 w-7 place-items-center rounded-full transition",
          value === "worst"
            ? "bg-red-400/20 text-red-300"
            : "text-white/35 hover:bg-white/[0.06] hover:text-red-200/80",
        ].join(" ")}
        onClick={() => onChange?.("worst")}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M7 13V4H4.5A1.5 1.5 0 0 0 3 5.5V11a2 2 0 0 0 2 2h2Zm0 0v2.8C7 18.1 8.8 20 11.2 20c.9 0 1.6-.7 1.6-1.6V15h4.7c1.5 0 2.6-1.4 2.3-2.8l-1.3-6A2.3 2.3 0 0 0 16.3 4H7"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

function RankedScrollList({ rows, emptyLabel, valueFn, onSelect }) {
  if (!rows?.length) {
    return <p className="m-0 text-[0.78rem] text-white/40">{emptyLabel}</p>;
  }

  return (
    <ul className="glass-scroll m-0 max-h-[9rem] list-none space-y-0.5 overflow-y-auto overscroll-contain p-0 pr-1">
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

function AttendancePulseCard({ nextEvent, rsvpData, participation, rows }) {
  const counts = rsvpData?.counts;
  const seats = rsvpData?.seats;
  const hasRsvps = counts && counts.total > 0;
  const list = (rows || []).filter((row) => row.gamesPlayed > 0);
  const rainchecks = (rsvpData?.rsvps || []).filter(
    (row) => row.status === "declined" && row.reasonCode
  );

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {seats?.lookingForFills ? (
        <p className="m-0 shrink-0 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[0.72rem] text-amber-50/90">
          Looking for fills
          {seats.target != null ? ` · ${seats.confirmed}/${seats.target}` : ""}
        </p>
      ) : null}
      {hasRsvps && nextEvent ? (
        <div className="shrink-0">
          <div className="grid grid-cols-4 gap-1.5">
            {[
              ["In", counts.confirmed, "text-emerald-200"],
              ["Wait", counts.waitlist || 0, "text-sky-200"],
              ["Out", counts.declined, "text-red-200"],
              ["N/A", counts.unavailable, "text-white/55"],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1">
                <p className="m-0 text-[0.55rem] uppercase tracking-[0.1em] text-white/40">{label}</p>
                <p className={`m-0 text-[0.95rem] font-medium tabular-nums ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          {rainchecks.length > 0 ? (
            <p className="m-0 mt-2 text-[0.68rem] text-white/45">
              {rainchecks.length} raincheck{rainchecks.length === 1 ? "" : "s"} — see{" "}
              <Link
                to={`/events/${nextEvent.id}`}
                className="text-sky-200/90 no-underline hover:text-sky-100"
              >
                Brief
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="m-0 shrink-0 text-[0.68rem] text-white/40">
          {participation?.poolSize || 0} comps in period
          {nextEvent ? (
            <>
              {" · "}
              <Link to={`/events/${nextEvent.id}`} className="text-sky-200/90 no-underline hover:text-sky-100">
                RSVP
              </Link>
            </>
          ) : null}
        </p>
      )}

      <RankedScrollList
        rows={list}
        emptyLabel="No players with matches in this period."
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
      emptyLabel="No players with matches in this period."
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
  const [pulsePeriod, setPulsePeriod] = useState("30d");
  const [attendanceRank, setAttendanceRank] = useState("best");
  const [formRank, setFormRank] = useState("best");

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

  const rsvpSeatsByEvent = useMemo(() => {
    const map = new Map();
    if (nextEvent?.id && nextRsvpQuery.data?.seats) {
      map.set(nextEvent.id, nextRsvpQuery.data.seats);
    }
    return map;
  }, [nextEvent?.id, nextRsvpQuery.data]);

  const periodEvents = useMemo(
    () => filterEventsByPeriod(historyQuery.data || [], pulsePeriod),
    [historyQuery.data, pulsePeriod]
  );

  const participation = useMemo(
    () => buildParticipationBoard(periodEvents, members),
    [periodEvents, members]
  );

  const attendanceRows = useMemo(
    () => applyRankFilter(participation.rows, attendanceRank, "gamesPlayed"),
    [participation.rows, attendanceRank]
  );

  const formRows = useMemo(() => {
    const merged = mergeCombatIntoFormBoard(participation.rows, combatQuery.data || {});
    return applyRankFilter(
      merged.filter((row) => row.gamesPlayed > 0),
      formRank,
      "winRate"
    );
  }, [participation.rows, combatQuery.data, formRank]);

  const seasonPulse = useMemo(
    () => buildSeasonPulse(periodEvents, events),
    [periodEvents, events]
  );

  const roleDepth = useMemo(() => buildRoleDepth(members), [members]);

  const loading =
    upcomingRange.isLoading ||
    historyQuery.isLoading ||
    openTasksQuery.isLoading ||
    (defaultRosterId && membersQuery.isLoading);

  const periodLabel = PULSE_PERIODS.find((p) => p.id === pulsePeriod)?.label || "Period";

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
              rsvpSeatsByEvent={rsvpSeatsByEvent}
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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.12em] text-white/35">
            Squad pulse · {periodLabel}
          </p>
          <PeriodSelector value={pulsePeriod} onChange={setPulsePeriod} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="glass-surface flex min-h-[9rem] flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="m-0 text-[0.88rem] font-medium text-white">Attendance pulse</h3>
                <p className="m-0 mt-1 text-[0.7rem] text-white/40">Ranked by comps played</p>
              </div>
              <RankToggle value={attendanceRank} onChange={setAttendanceRank} />
            </div>
            <div className="mt-3 min-h-0">
              <AttendancePulseCard
                nextEvent={nextEvent}
                rsvpData={nextRsvpQuery.data}
                participation={participation}
                rows={attendanceRows}
              />
            </div>
          </div>

          <div className="glass-surface flex min-h-[9rem] flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="m-0 text-[0.88rem] font-medium text-white">Player form</h3>
                <p className="m-0 mt-1 text-[0.7rem] text-white/40">Ranked by win rate · click profile</p>
              </div>
              <RankToggle value={formRank} onChange={setFormRank} />
            </div>
            <div className="mt-3 min-h-0">
              <PlayerFormBoard rows={formRows} onSelect={setSelectedPlayer} />
            </div>
          </div>

          <div className="glass-surface flex min-h-[9rem] flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <h3 className="m-0 text-[0.88rem] font-medium text-white">Season pulse</h3>
            <p className="m-0 mt-1 text-[0.7rem] text-white/40">{periodLabel} team results</p>
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
