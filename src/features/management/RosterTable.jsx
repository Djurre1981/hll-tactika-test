import { useEffect, useRef, useState } from "react";
import {
  COMP_ROLES,
  COMP_SITUATIONS,
  COMP_STATUSES,
  getCompRoles,
  getCompStatus,
  getSituation,
  initials,
  isValidT17Id,
  parseCompRoles,
  parseTournaments,
  T17_ID_LENGTH,
  tournamentColor,
} from "./rosterRoles.js";

function useOutsideClose(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    function onDoc(event) {
      if (!ref.current?.contains(event.target)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);
  return ref;
}

function RoleDropdown({ member, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const selected = parseCompRoles(member.rosterRoles?.length ? member.rosterRoles : member.rosterRole);
  const roles = getCompRoles(selected);

  function toggle(roleId) {
    const next = selected.includes(roleId)
      ? selected.filter((id) => id !== roleId)
      : [...selected, roleId];
    if (next.length === 0) return;
    onChange?.(next);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="inline-flex items-center text-left transition hover:opacity-90 disabled:opacity-45"
        disabled={disabled}
        aria-label={
          roles.length === 1 ? roles[0].label : roles.length ? `${roles.length} roles` : "Select roles"
        }
        onClick={(event) => {
          event.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="flex items-center gap-1">
          {roles.map((role) => (
            <img
              key={role.id}
              src={role.icon}
              alt=""
              title={role.label}
              className="h-7 w-7 rounded-full border border-black/30 object-contain"
              style={{ background: `${role.color}44` }}
            />
          ))}
        </span>
      </button>
      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+0.3rem)] z-30 min-w-[11rem] overflow-hidden rounded-xl border border-white/12 bg-[rgba(20,20,26,0.98)] p-1 shadow-xl"
          role="menu"
        >
          {COMP_ROLES.map((option) => {
            const checked = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-[0.75rem] text-white/80 hover:bg-white/[0.08]"
                onClick={(event) => {
                  event.stopPropagation();
                  toggle(option.id);
                }}
              >
                <span
                  className={[
                    "grid h-3.5 w-3.5 place-items-center rounded border text-[0.55rem]",
                    checked ? "border-white/40 bg-white/20 text-white" : "border-white/20 text-transparent",
                  ].join(" ")}
                >
                  ✓
                </span>
                <img
                  src={option.icon}
                  alt=""
                  className="h-6 w-6 rounded-full object-contain"
                  style={{ background: `${option.color}33` }}
                />
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SituationDropdown({ member, disabled, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const situation = getSituation(member.situation);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.72rem] text-white/75 transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-45"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {situation.label}
      </button>
      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+0.3rem)] z-30 min-w-[8rem] overflow-hidden rounded-xl border border-white/12 bg-[rgba(20,20,26,0.98)] p-1 shadow-xl"
          role="menu"
        >
          {COMP_SITUATIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitem"
              className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[0.75rem] text-white/80 hover:bg-white/[0.08]"
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.(option.id);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatusDropdown({ member, disabled, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const status = getCompStatus(member.status);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title={status.hint}
        className={[
          "rounded-full border px-2.5 py-1 text-[0.72rem] transition hover:border-white/20 disabled:opacity-45",
          status.id === "na"
            ? "border-red-400/30 bg-red-500/10 text-red-100"
            : status.id === "inactive"
              ? "border-white/15 bg-white/[0.04] text-white/45"
              : status.id === "trial"
                ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                : "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
        ].join(" ")}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {status.label}
      </button>
      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+0.3rem)] z-30 min-w-[10rem] overflow-hidden rounded-xl border border-white/12 bg-[rgba(20,20,26,0.98)] p-1 shadow-xl"
          role="menu"
        >
          {COMP_STATUSES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitem"
              title={option.hint}
              className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[0.75rem] text-white/80 hover:bg-white/[0.08]"
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.(option.id);
                setOpen(false);
              }}
            >
              <span className="font-medium">{option.label}</span>
              <span className="mt-0.5 block text-[0.65rem] text-white/40">{option.hint}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TournamentDropdown({ member, options, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useOutsideClose(open, () => {
    setOpen(false);
    setAdding(false);
    setDraft("");
  });
  const selected = parseTournaments(member.tournaments);
  const catalog = [...new Set([...options, ...selected])].sort((a, b) => a.localeCompare(b));

  function toggle(name) {
    const next = selected.includes(name)
      ? selected.filter((t) => t !== name)
      : [...selected, name];
    onChange?.(next);
  }

  function commitAdd() {
    const name = draft.trim();
    if (!name) return;
    onChange?.([...new Set([...selected, name])]);
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="inline-flex max-w-[9rem] items-center gap-1 truncate rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-left text-[0.7rem] text-white/75 transition hover:border-white/20 disabled:opacity-45"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="truncate">
          {selected.length === 0 ? "—" : selected.length === 1 ? selected[0] : `${selected.length} tags`}
        </span>
        <svg className="h-3 w-3 shrink-0 text-white/40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+0.3rem)] z-30 min-w-[12rem] overflow-hidden rounded-xl border border-white/12 bg-[rgba(20,20,26,0.98)] p-1.5 shadow-xl"
          role="menu"
        >
          {catalog.length === 0 && !adding ? (
            <p className="m-0 px-2 py-2 text-[0.72rem] text-white/40">No tournaments yet</p>
          ) : (
            catalog.map((name) => {
              const tone = tournamentColor(name);
              const checked = selected.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[0.72rem] hover:bg-white/[0.08]"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(name);
                  }}
                >
                  <span
                    className={[
                      "grid h-3.5 w-3.5 place-items-center rounded border text-[0.55rem]",
                      checked ? "border-white/40 bg-white/20 text-white" : "border-white/20 text-transparent",
                    ].join(" ")}
                  >
                    ✓
                  </span>
                  <span
                    className="truncate rounded-full border px-2 py-0.5"
                    style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}
                  >
                    {name}
                  </span>
                </button>
              );
            })
          )}
          {adding ? (
            <div className="mt-1 flex gap-1 border-t border-white/10 pt-1.5">
              <input
                className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.05] px-2 py-1 text-[0.72rem] text-white"
                value={draft}
                autoFocus
                placeholder="Tournament name"
                maxLength={80}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitAdd();
                  }
                }}
              />
              <button
                type="button"
                className="rounded-lg bg-white/15 px-2 text-[0.72rem] text-white"
                onClick={(event) => {
                  event.stopPropagation();
                  commitAdd();
                }}
              >
                Add
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-white/10 px-2 py-1.5 text-left text-[0.72rem] text-white/55 hover:bg-white/[0.08] hover:text-white/80"
              onClick={(event) => {
                event.stopPropagation();
                setAdding(true);
              }}
            >
              + Add tournament
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function NameCell({ member, disabled, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(member.displayName || "");

  useEffect(() => {
    if (!editing) setDraft(member.displayName || "");
  }, [member.displayName, editing]);

  if (!editing) {
    return (
      <button
        type="button"
        className="flex min-w-0 max-w-[12rem] items-center gap-1 text-left disabled:opacity-45"
        title="Edit name"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setEditing(true);
        }}
      >
        <span className="truncate text-[0.82rem] font-medium text-white">{member.displayName}</span>
        <svg className="h-3 w-3 shrink-0 text-white/35" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 20h4l10.5-10.5-4-4L4 16v4zM14.5 5.5l4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
  }

  return (
    <input
      className="w-[12rem] rounded-lg border border-white/15 bg-white/[0.05] px-2 py-1 text-[0.82rem] text-white"
      value={draft}
      autoFocus
      maxLength={80}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        onSave?.(draft);
        setEditing(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSave?.(draft);
          setEditing(false);
        }
        if (event.key === "Escape") {
          setDraft(member.displayName || "");
          setEditing(false);
        }
      }}
    />
  );
}

function T17Cell({ member, disabled, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(member.t17Id || "");
  const invalid = draft.trim().length > 0 && !isValidT17Id(draft);

  useEffect(() => {
    if (!editing) setDraft(member.t17Id || "");
  }, [member.t17Id, editing]);

  if (!editing) {
    return (
      <button
        type="button"
        className="inline-flex max-w-[12rem] items-center gap-1 truncate font-mono text-[0.72rem] text-white/55 transition hover:text-white/85 disabled:opacity-45"
        title="Edit T17 ID"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setEditing(true);
        }}
      >
        <span className="truncate">{member.t17Id || "—"}</span>
        <svg className="h-3 w-3 shrink-0 text-white/35" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 20h4l10.5-10.5-4-4L4 16v4zM14.5 5.5l4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex w-[12rem] flex-col gap-0.5" onClick={(event) => event.stopPropagation()}>
      <input
        className={[
          "w-full rounded-lg border bg-white/[0.05] px-1.5 py-1 font-mono text-[0.7rem] text-white",
          invalid ? "border-[#f0a8a8]/70" : "border-white/15",
        ].join(" ")}
        value={draft}
        autoFocus
        maxLength={T17_ID_LENGTH}
        placeholder={`${T17_ID_LENGTH} chars`}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (invalid) return;
          onSave?.(draft);
          setEditing(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (invalid) return;
            onSave?.(draft);
            setEditing(false);
          }
          if (event.key === "Escape") {
            setDraft(member.t17Id || "");
            setEditing(false);
          }
        }}
      />
      <span className={["text-[0.58rem]", invalid ? "text-[#f0a8a8]" : "text-white/35"].join(" ")}>
        {draft.trim().length}/{T17_ID_LENGTH}
      </span>
    </div>
  );
}

export function RosterTable({
  members,
  selectedId,
  tournamentOptions = [],
  onOpenCard,
  onSetRoles,
  onSetSituation,
  onSetStatus,
  onSetTournaments,
  onSetT17Id,
  onSetDisplayName,
  onRemoveMember,
  actionPending = false,
}) {
  if (members.length === 0) {
    return (
      <p className="my-8 text-center text-[0.88rem] text-white/45">No members in this roster yet.</p>
    );
  }

  return (
    <div className="hub-scroll min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[64rem] border-collapse text-left">
        <thead className="sticky top-0 z-[1] bg-[rgba(18,18,22,0.92)] backdrop-blur-md">
          <tr className="text-[0.62rem] font-normal uppercase tracking-[0.12em] text-white/40">
            <th className="w-[14rem] max-w-[14rem] px-2 py-2 font-normal">Member</th>
            <th className="w-[9rem] px-2 py-2 pr-1 font-normal">Steam ID</th>
            <th className="w-[13rem] px-1 py-2 pl-1 font-normal">T17 ID</th>
            <th className="px-2 py-2 font-normal">Role</th>
            <th className="px-2 py-2 font-normal">Situation</th>
            <th className="px-2 py-2 font-normal">Status</th>
            <th className="px-2 py-2 font-normal">Tournament</th>
            <th className="w-20 px-2 py-2 font-normal" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const selected = member.id === selectedId;
            const status = getCompStatus(member.status);
            const dimmed = status.id === "na" || status.id === "inactive";
            return (
              <tr
                key={member.id}
                className={`border-t border-white/[0.06] transition ${
                  selected ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"
                } ${dimmed ? "opacity-55" : ""}`}
              >
                <td className="w-[14rem] max-w-[14rem] px-2 py-1.5 align-middle">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.03] text-[0.58rem] font-medium text-white/40 transition hover:border-white/20"
                      aria-label={`Open ${member.displayName} profile`}
                      onClick={() => onOpenCard?.(member)}
                    >
                      {member.avatarUrl ? (
                        <img className="h-full w-full object-cover" src={member.avatarUrl} alt="" />
                      ) : (
                        initials(member.displayName)
                      )}
                    </button>
                    <NameCell
                      member={member}
                      disabled={actionPending}
                      onSave={(value) => onSetDisplayName?.(member, value)}
                    />
                  </div>
                </td>
                <td className="w-[9rem] px-2 py-1.5 pr-1 align-middle font-mono text-[0.65rem] text-white/55">
                  <span className="block max-w-[8.5rem] truncate">{member.steamId || "—"}</span>
                </td>
                <td className="w-[13rem] px-1 py-1.5 pl-1 align-middle">
                  <T17Cell
                    member={member}
                    disabled={actionPending}
                    onSave={(value) => onSetT17Id?.(member, value)}
                  />
                </td>
                <td className="px-2 py-1.5 align-middle">
                  <RoleDropdown
                    member={member}
                    disabled={actionPending}
                    onChange={(roles) => onSetRoles?.(member, roles)}
                  />
                </td>
                <td className="px-2 py-1.5 align-middle">
                  <SituationDropdown
                    member={member}
                    disabled={actionPending}
                    onSelect={(situation) => onSetSituation?.(member, situation)}
                  />
                </td>
                <td className="px-2 py-1.5 align-middle">
                  <StatusDropdown
                    member={member}
                    disabled={actionPending}
                    onSelect={(nextStatus) => onSetStatus?.(member, nextStatus)}
                  />
                </td>
                <td className="px-2 py-1.5 align-middle">
                  <TournamentDropdown
                    member={member}
                    options={tournamentOptions}
                    disabled={actionPending}
                    onChange={(tournaments) => onSetTournaments?.(member, tournaments)}
                  />
                </td>
                <td className="px-2 py-1.5 text-right align-middle">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      className="grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-white/[0.05] text-white/70 transition hover:bg-white/[0.1]"
                      aria-label={`Open card for ${member.displayName}`}
                      onClick={() => onOpenCard?.(member)}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M9 5l7 7-7 7"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="grid h-7 w-7 place-items-center rounded-full border border-[#f0a8a8]/35 bg-[#f0a8a8]/12 text-[#f0a8a8] transition hover:border-[#f0a8a8]/55 hover:bg-[#f0a8a8]/20 disabled:opacity-45"
                      aria-label={`Remove ${member.displayName}`}
                      disabled={actionPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveMember?.(member);
                      }}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M6 7h12M10 7V5.5h4V7M9 7l.6 12h4.8L15 7"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
