import { Link } from "react-router-dom";
import {
  getCompRoles,
  getCompStatus,
  getSituation,
  initials,
  parseTournaments,
  tournamentColor,
  COMP_STATUSES,
} from "./rosterRoles.js";
import { buildPlayerDossier } from "./player-dossier-utils.js";

function StatTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2.5">
      <p className="m-0 text-[0.6rem] uppercase tracking-[0.12em] text-white/40">{label}</p>
      <p className="m-0 mt-1 text-[1.05rem] font-medium text-white/85">{value ?? "—"}</p>
    </div>
  );
}

function resultClass(result) {
  if (result === "win") return "text-emerald-200";
  if (result === "loss") return "text-red-200";
  return "text-white/45";
}

export function PlayerCard({
  member,
  dossier,
  onClose,
  onSetStatus,
  statusPending = false,
}) {
  if (!member) return null;

  const roles = getCompRoles(member.rosterRoles?.length ? member.rosterRoles : member.rosterRole);
  const primary = roles[0];
  const situation = getSituation(member.situation);
  const status = getCompStatus(member.status);
  const tournaments = parseTournaments(member.tournaments);
  const accent = primary.color;
  const stats = dossier || buildPlayerDossier(member, [], {});

  return (
    <aside
      className="flex h-full min-h-0 w-full max-w-[22rem] flex-col overflow-hidden rounded-[1.75rem] border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
      style={{ background: accent }}
    >
      <header className="relative z-[2] flex shrink-0 items-center justify-between px-4 pt-4">
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-black/15 text-black/70 transition hover:bg-black/25 hover:text-black"
          aria-label="Close player card"
          onClick={onClose}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <span className="text-[0.68rem] uppercase tracking-[0.14em] text-black/45">
          {roles.length === 1 ? primary.label : `${roles.length} roles`}
        </span>
      </header>

      <div className="hub-scroll relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex flex-col items-center px-5 pb-4 pt-2">
          <div
            className="absolute left-1/2 top-4 h-48 w-48 -translate-x-1/2 rounded-full bg-white/90"
            aria-hidden="true"
          />
          <div className="relative z-[1] mt-6 grid h-44 w-44 place-items-center overflow-hidden rounded-full border-4 border-white/40 bg-black/20 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
            {member.avatarUrl ? (
              <img className="h-full w-full object-cover" src={member.avatarUrl} alt="" />
            ) : (
              <span className="text-4xl font-medium tracking-wide text-white/90">
                {initials(member.displayName)}
              </span>
            )}
          </div>
          <div className="relative z-[1] -mt-4 flex -space-x-2">
            {roles.map((role) => (
              <img
                key={role.id}
                src={role.icon}
                alt=""
                title={role.label}
                className="h-11 w-11 rounded-xl border border-white/30 bg-black/40 object-contain p-1 shadow-lg"
              />
            ))}
          </div>
        </div>

        <div className="relative z-[1] rounded-t-[1.75rem] bg-[#12141a] px-5 pb-6 pt-6 text-white">
          <p className="m-0 text-[0.7rem] uppercase tracking-[0.14em] text-white/40">
            {situation.label} · {status.label}
          </p>
          <h3 className="m-0 mt-1 text-[1.55rem] font-medium leading-tight text-white">
            {member.displayName}
          </h3>
          <p className="mt-1 text-[0.85rem] text-white/50">
            {roles.map((r) => r.label).join(" · ")}
          </p>
          <p className="mt-2 break-all font-mono text-[0.7rem] text-white/40">
            {member.steamId ? `Steam ${member.steamId}` : "No Steam ID"}
          </p>
          {member.t17Id ? (
            <p className="mt-0.5 break-all font-mono text-[0.7rem] text-white/40">
              T17 {member.t17Id}
            </p>
          ) : null}

          <div className="mt-4">
            <p className="m-0 text-[0.6rem] uppercase tracking-[0.12em] text-white/40">Status</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COMP_STATUSES.map((option) => {
                const active = status.id === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    title={option.hint}
                    disabled={statusPending || !onSetStatus}
                    className={`rounded-full border px-2.5 py-1 text-[0.72rem] transition disabled:opacity-45 ${
                      active
                        ? "border-white/30 bg-white/15 text-white"
                        : "border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08]"
                    }`}
                    onClick={() => onSetStatus?.(option.id)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <StatTile label="K/D" value={stats.kd} />
            <StatTile
              label="Last game"
              value={stats.lastGame ? stats.lastGame.when.replace(/,.*/, "") : "—"}
            />
            <StatTile label="Games" value={stats.gamesPlayed} />
            <StatTile
              label="Win %"
              value={stats.winRate != null ? `${stats.winRate}%` : "—"}
            />
            <StatTile label="Record" value={stats.recordLabel} />
            <StatTile label="Combat" value={stats.combatPoints} />
          </div>

          {stats.lastGame ? (
            <p className="m-0 mt-2 text-[0.72rem] text-white/45">
              Last:{" "}
              <Link
                to={`/events/${stats.lastGame.id}`}
                className="text-sky-200/90 no-underline hover:text-sky-100"
              >
                {stats.lastGame.title}
              </Link>
              {stats.lastGame.result ? (
                <span className={`ml-1 ${resultClass(stats.lastGame.result)}`}>
                  ({stats.lastGame.result})
                </span>
              ) : null}
            </p>
          ) : null}

          <div className="mt-5">
            <p className="m-0 text-[0.6rem] uppercase tracking-[0.12em] text-white/40">
              Matches played
            </p>
            {stats.matches?.length ? (
              <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                {stats.matches.map((match) => (
                  <li key={match.id}>
                    <Link
                      to={`/events/${match.id}`}
                      className="block rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 no-underline transition hover:border-white/20 hover:bg-white/[0.07]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="m-0 text-[0.8rem] font-medium text-white/90">{match.title}</p>
                        <span className={`shrink-0 text-[0.68rem] uppercase ${resultClass(match.result)}`}>
                          {match.result || "—"}
                        </span>
                      </div>
                      <p className="m-0 mt-0.5 text-[0.68rem] text-white/40">
                        {match.when}
                        {match.line ? ` · ${match.line}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 mt-2 text-[0.78rem] text-white/40">
                No HeLO-linked matches for this Steam ID yet.
              </p>
            )}
          </div>

          <div className="mt-5">
            <p className="m-0 text-[0.6rem] uppercase tracking-[0.12em] text-white/40">Roles</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {roles.map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] py-1 pl-1 pr-3"
                >
                  <img
                    src={role.icon}
                    alt=""
                    className="h-7 w-7 rounded-full object-contain"
                    style={{ background: `${role.color}33` }}
                  />
                  <span className="text-[0.78rem] text-white/85">{role.label}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="m-0 text-[0.6rem] uppercase tracking-[0.12em] text-white/40">Tournaments</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tournaments.length === 0 ? (
                <span className="text-[0.78rem] text-white/40">None assigned</span>
              ) : (
                tournaments.map((name) => {
                  const tone = tournamentColor(name);
                  return (
                    <span
                      key={name}
                      className="rounded-full border px-2.5 py-1 text-[0.72rem]"
                      style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}
                    >
                      {name}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-black/50 px-3 py-2.5">
            <span className="text-[0.72rem] text-white/50">Comp profile</span>
            <span
              className="rounded-lg px-3 py-1.5 text-[0.72rem] font-medium text-black"
              style={{ background: accent }}
            >
              {status.label}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
