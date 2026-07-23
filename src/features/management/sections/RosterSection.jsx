import { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "../../../shared/Spinner.jsx";
import { PlayerCard } from "../PlayerCard.jsx";
import { RosterTable } from "../RosterTable.jsx";
import {
  COMP_ROLES,
  COMP_SITUATIONS,
  COMP_STATUSES,
  DEFAULT_VISIBLE_STATUSES,
  getCompStatus,
  getSituation,
  isValidT17Id,
  parseCompRoles,
  parseTournaments,
  ROSTER_COLOR_PRESETS,
  T17_ID_LENGTH,
} from "../rosterRoles.js";
import { buildPlayerDossier } from "../player-dossier-utils.js";
import {
  useAddRosterMemberToRosterMutation,
  useCreateRosterMutation,
  useDeleteRosterMutation,
  useDuplicateRosterMutation,
  useImportRosterCsvMutation,
  useRemoveMemberFromRosterMutation,
  useRosterMembersQuery,
  useRostersQuery,
  useSeedRosterFromHeloMutation,
  useUpdateRosterMemberMutation,
  useUpdateRosterMutation,
} from "../hooks/useRostersQuery.js";
import { useMatchHistoryQuery } from "../../records/hooks/useMatchHistoryQuery.js";
import { usePlayerStatsAggregatesQuery } from "../hooks/usePlayerStatsQuery.js";

const fieldClass =
  "min-h-[2rem] min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-sm text-white/90";

const topBtnClass =
  "rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[0.8rem] text-white/80 transition hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-45";

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

function FilterDropdown({ label, options, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const count = selected.length;
  const summary =
    count === 0
      ? label
      : count === 1
        ? options.find((o) => o.id === selected[0])?.label || selected[0]
        : `${label} (${count})`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={[
          "inline-flex max-w-[9.5rem] items-center gap-1 rounded-full border px-2.5 py-1 text-[0.7rem] transition",
          count > 0
            ? "border-white/25 bg-white/12 text-white"
            : "border-white/10 bg-white/[0.04] text-white/55 hover:text-white/80",
        ].join(" ")}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{summary}</span>
        <svg className="h-3 w-3 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+0.3rem)] z-30 min-w-[9.5rem] overflow-hidden rounded-xl border border-white/10 bg-[rgba(20,20,26,0.98)] p-1 shadow-xl"
          role="menu"
        >
          {options.length === 0 ? (
            <p className="m-0 px-2.5 py-2 text-[0.72rem] text-white/40">None yet</p>
          ) : (
            options.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[0.72rem] text-white/80 hover:bg-white/[0.08]"
                  onClick={() => onToggle(option.id)}
                >
                  <span
                    className={[
                      "grid h-3.5 w-3.5 place-items-center rounded border text-[0.55rem]",
                      checked ? "border-white/40 bg-white/20 text-white" : "border-white/20 text-transparent",
                    ].join(" ")}
                  >
                    ✓
                  </span>
                  {option.icon ? (
                    <img
                      src={option.icon}
                      alt=""
                      className="h-5 w-5 rounded-full object-contain"
                      style={{ background: `${option.color || "#888"}33` }}
                    />
                  ) : null}
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function IconButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/[0.05] text-white/60 transition hover:bg-white/[0.1] hover:text-white"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function exportMembersCsv(members, rosterName) {
  const rows = [
    ["name", "steamid", "t17id", "role", "situation", "status", "tournaments"],
    ...members.map((m) => [
      m.displayName || "",
      m.steamId || "",
      m.t17Id || "",
      (m.rosterRoles?.length ? m.rosterRoles : [m.rosterRole]).filter(Boolean).join(";"),
      m.situation || "member",
      m.status || "active",
      parseTournaments(m.tournaments).join(";"),
    ]),
  ];
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${(rosterName || "roster").replace(/\s+/g, "-").toLowerCase()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RosterSection() {
  const [activeRosterId, setActiveRosterId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterSituations, setFilterSituations] = useState([]);
  const [filterRoles, setFilterRoles] = useState([]);
  const [filterTournaments, setFilterTournaments] = useState([]);
  const [filterStatuses, setFilterStatuses] = useState([...DEFAULT_VISIBLE_STATUSES]);
  const [showAdd, setShowAdd] = useState(false);
  const [rosterMenuOpen, setRosterMenuOpen] = useState(false);
  const [rosterMenuMode, setRosterMenuMode] = useState(null);
  const [rosterNameDraft, setRosterNameDraft] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [steamId, setSteamId] = useState("");
  const [t17Id, setT17Id] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef(null);
  const rosterMenuRef = useRef(null);

  const rostersQuery = useRostersQuery();
  const rosters = rostersQuery.data?.rosters || [];

  useEffect(() => {
    if (!activeRosterId && rosters.length > 0) {
      setActiveRosterId(rosters[0].id);
    }
  }, [activeRosterId, rosters]);

  useEffect(() => {
    if (!rosterMenuOpen) {
      setRosterMenuMode(null);
      setRosterNameDraft("");
      return undefined;
    }
    function onDocClick(event) {
      if (!rosterMenuRef.current?.contains(event.target)) {
        setRosterMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [rosterMenuOpen]);

  const membersQuery = useRosterMembersQuery(activeRosterId);
  const historyQuery = useMatchHistoryQuery();
  const createRoster = useCreateRosterMutation();
  const updateRoster = useUpdateRosterMutation();
  const deleteRoster = useDeleteRosterMutation();
  const duplicateRoster = useDuplicateRosterMutation();
  const seedFromHelo = useSeedRosterFromHeloMutation(activeRosterId);
  const addMember = useAddRosterMemberToRosterMutation(activeRosterId);
  const removeMember = useRemoveMemberFromRosterMutation(activeRosterId);
  const updateMember = useUpdateRosterMemberMutation(activeRosterId);
  const importCsv = useImportRosterCsvMutation(activeRosterId);

  const members = membersQuery.data?.members || [];
  const activeRoster = rosters.find((r) => r.id === activeRosterId) || null;
  const selected = members.find((m) => m.id === selectedId) || null;
  const cardOpen = Boolean(selected);

  const steamIds = useMemo(
    () => members.map((m) => m.steamId).filter(Boolean),
    [members]
  );
  const combatQuery = usePlayerStatsAggregatesQuery(steamIds, steamIds.length > 0);

  const selectedDossier = useMemo(() => {
    if (!selected) return null;
    return buildPlayerDossier(selected, historyQuery.data || [], combatQuery.data || {});
  }, [selected, historyQuery.data, combatQuery.data]);

  const tournamentOptions = useMemo(() => {
    const set = new Set();
    for (const member of members) {
      for (const name of parseTournaments(member.tournaments)) set.add(name);
    }
    if (activeRoster?.tournament) set.add(activeRoster.tournament);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [members, activeRoster?.tournament]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      if (filterStatuses.length > 0) {
        const status = getCompStatus(member.status).id;
        if (!filterStatuses.includes(status)) return false;
      }
      if (filterSituations.length > 0) {
        const situation = getSituation(member.situation).id;
        if (!filterSituations.includes(situation)) return false;
      }
      if (filterRoles.length > 0) {
        const roles = parseCompRoles(member.rosterRoles?.length ? member.rosterRoles : member.rosterRole);
        if (!filterRoles.some((role) => roles.includes(role))) return false;
      }
      if (filterTournaments.length > 0) {
        const tags = parseTournaments(member.tournaments);
        if (!filterTournaments.some((t) => tags.includes(t))) return false;
      }
      if (!needle) return true;
      const haystack = [
        member.displayName,
        member.steamId,
        member.t17Id,
        member.rosterRole,
        member.situation,
        member.status,
        ...(member.tournaments || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [members, query, filterSituations, filterRoles, filterTournaments, filterStatuses]);

  useEffect(() => {
    setSelectedId(null);
    setImportMessage("");
  }, [activeRosterId]);

  function handleCreateRoster() {
    const name = rosterNameDraft.trim();
    if (!name) return;
    createRoster.mutate(
      { name, color: ROSTER_COLOR_PRESETS[0] },
      {
        onSuccess: (data) => {
          setRosterMenuOpen(false);
          if (data?.roster?.id) setActiveRosterId(data.roster.id);
        },
      },
    );
  }

  function handleRenameRoster() {
    if (!activeRoster) return;
    const name = rosterNameDraft.trim();
    if (!name || name === activeRoster.name) return;
    updateRoster.mutate(
      { id: activeRoster.id, name },
      { onSuccess: () => setRosterMenuOpen(false) },
    );
  }

  function handleDeleteRoster() {
    if (!activeRoster) return;
    const id = activeRoster.id;
    deleteRoster.mutate(id, {
      onSuccess: () => {
        setRosterMenuOpen(false);
        const next = rosters.find((r) => r.id !== id);
        setActiveRosterId(next?.id || null);
      },
    });
  }

  function handleDuplicateRoster() {
    if (!activeRoster) return;
    duplicateRoster.mutate(
      {
        rosterId: activeRoster.id,
        name: `${activeRoster.name} (copy)`,
        isTemplate: Boolean(activeRoster.isTemplate),
      },
      {
        onSuccess: (data) => {
          setRosterMenuOpen(false);
          if (data?.roster?.id) setActiveRosterId(data.roster.id);
        },
      },
    );
  }

  function handleToggleTemplate() {
    if (!activeRoster) return;
    updateRoster.mutate({
      id: activeRoster.id,
      isTemplate: !activeRoster.isTemplate,
    });
  }

  function handleSetRosterColor(color) {
    if (!activeRoster) return;
    updateRoster.mutate({ id: activeRoster.id, color });
  }

  function handleAdd(event) {
    event.preventDefault();
    if (!activeRosterId) return;
    if (!isValidT17Id(t17Id)) {
      setImportMessage(`T17 ID must be exactly ${T17_ID_LENGTH} characters`);
      return;
    }
    addMember.mutate(
      {
        displayName: displayName.trim(),
        steamId: steamId.trim(),
        t17Id: t17Id.trim() || null,
        rosterRoles: ["infantry"],
        situation: "member",
        status: "active",
      },
      {
        onSuccess: () => {
          setDisplayName("");
          setSteamId("");
          setT17Id("");
          setShowAdd(false);
          setImportMessage("");
        },
      },
    );
  }

  function handleSetRoles(member, nextRoles) {
    updateMember.mutate({ id: member.id, rosterRoles: nextRoles });
  }

  function handleSetSituation(member, situation) {
    updateMember.mutate({ id: member.id, situation });
  }

  function handleSetStatus(member, status) {
    updateMember.mutate({ id: member.id, status });
  }

  function handleRemoveMember(member) {
    if (!window.confirm(`Remove “${member.displayName}” from this roster?`)) return;
    removeMember.mutate(member.id, {
      onSuccess: () => {
        if (selectedId === member.id) setSelectedId(null);
      },
    });
  }

  function handleSetTournaments(member, tournaments) {
    updateMember.mutate({ id: member.id, tournaments });
  }

  function handleSetT17Id(member, nextT17) {
    if (!isValidT17Id(nextT17)) return;
    updateMember.mutate({ id: member.id, t17Id: nextT17.trim() || null });
  }

  function handleSetDisplayName(member, nextName) {
    const displayName = String(nextName || "").trim();
    if (!displayName || displayName === member.displayName) return;
    updateMember.mutate({ id: member.id, displayName });
  }

  function toggleFilterSituation(id) {
    setFilterSituations((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleFilterRole(id) {
    setFilterRoles((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleFilterTournament(name) {
    setFilterTournaments((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  }

  function toggleFilterStatus(id) {
    setFilterStatuses((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSeedFromHelo() {
    if (!activeRosterId) return;
    if (
      !window.confirm(
        "Add players found on HeLO-linked matches to this roster?\n\nThis does not grant site access. Existing members are linked if missing."
      )
    ) {
      return;
    }
    setImportMessage("");
    seedFromHelo.mutate(undefined, {
      onSuccess: (data) => {
        const rem = Number(data.remaining) || 0;
        setImportMessage(
          `HeLO seed: +${data.added || 0} new · ${data.linked || 0} linked · ${data.skipped || 0} already on roster · ${data.failed || 0} failed (${data.totalSteamIds || 0} Steam IDs total)${
            rem > 0 ? ` · ${rem} still pending — click Seed again` : " · done"
          }`
        );
      },
      onError: (err) => {
        setImportMessage(err?.message || "HeLO seed failed — hard-refresh; partial data may already be saved");
      },
    });
  }

  async function handleCsvFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !activeRosterId) return;
    const text = await file.text();
    setImportMessage("");
    importCsv.mutate(text, {
      onSuccess: (data) => {
        const parts = [
          `Imported ${data.imported || 0}`,
          data.skipped ? `skipped ${data.skipped}` : null,
          data.errors?.length ? `${data.errors.length} errors` : null,
        ].filter(Boolean);
        setImportMessage(parts.join(" · "));
      },
      onError: (err) => setImportMessage(err.message || "Import failed"),
    });
  }

  const pending =
    createRoster.isPending ||
    updateRoster.isPending ||
    deleteRoster.isPending ||
    duplicateRoster.isPending ||
    seedFromHelo.isPending ||
    addMember.isPending ||
    removeMember.isPending ||
    updateMember.isPending ||
    importCsv.isPending;
  const error =
    rostersQuery.error?.message ||
    membersQuery.error?.message ||
    createRoster.error?.message ||
    updateRoster.error?.message ||
    deleteRoster.error?.message ||
    addMember.error?.message ||
    removeMember.error?.message ||
    updateMember.error?.message ||
    importCsv.error?.message;

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-[clamp(1.55rem,2.2vw,2rem)] font-medium tracking-wide text-white">
            The Circle - Comp Rosters
          </h2>
          <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] w-[min(18rem,70vw)]" ref={rosterMenuRef}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-left text-[0.85rem] text-white/85 transition hover:bg-white/[0.1]"
              aria-expanded={rosterMenuOpen}
              aria-haspopup="menu"
              onClick={() => setRosterMenuOpen((o) => !o)}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
                style={{ background: activeRoster?.color || "#5b8def" }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">
                {activeRoster?.name || "Select roster"}
                {activeRoster?.isTemplate ? " · template" : ""}
                {activeRoster ? (
                  <span className="text-white/40"> ({activeRoster.memberCount})</span>
                ) : null}
              </span>
              <svg className="h-3.5 w-3.5 shrink-0 text-white/45" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            {rosterMenuOpen ? (
              <div
                className="absolute right-0 top-[calc(100%+0.4rem)] z-20 w-full min-w-[16rem] overflow-hidden rounded-2xl border border-white/12 bg-[rgba(22,22,28,0.96)] p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                role="menu"
              >
                {rostersQuery.isLoading ? (
                  <div className="flex justify-center py-4">
                    <Spinner />
                  </div>
                ) : (
                  <>
                    {rosters.map((roster) => (
                      <button
                        key={roster.id}
                        type="button"
                        role="menuitem"
                        className={[
                          "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[0.82rem] transition",
                          roster.id === activeRosterId
                            ? "bg-white/12 text-white"
                            : "text-white/70 hover:bg-white/[0.06] hover:text-white",
                        ].join(" ")}
                        onClick={() => {
                          setActiveRosterId(roster.id);
                          setRosterMenuOpen(false);
                        }}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: roster.color || "#5b8def" }}
                        />
                        <span className="min-w-0 flex-1 truncate">{roster.name}</span>
                        <span className="text-white/35">{roster.memberCount}</span>
                      </button>
                    ))}
                    <div className="my-1 border-t border-white/10" />
                    <div className="px-2 pb-1.5 pt-1">
                      <p className="mb-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/35">
                        Color
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {ROSTER_COLOR_PRESETS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={[
                              "h-5 w-5 rounded-full border transition",
                              activeRoster?.color === color
                                ? "border-white scale-110"
                                : "border-white/20 hover:border-white/50",
                            ].join(" ")}
                            style={{ background: color }}
                            aria-label={`Set roster color ${color}`}
                            disabled={!activeRoster || pending}
                            onClick={() => handleSetRosterColor(color)}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="my-1 border-t border-white/10" />
                    {rosterMenuMode === "create" ? (
                      <form
                        className="flex gap-1.5 px-1.5 py-1.5"
                        onSubmit={(event) => {
                          event.preventDefault();
                          handleCreateRoster();
                        }}
                      >
                        <input
                          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1.5 text-[0.82rem] text-white"
                          value={rosterNameDraft}
                          autoFocus
                          placeholder="Roster name"
                          maxLength={80}
                          onChange={(event) => setRosterNameDraft(event.target.value)}
                        />
                        <button
                          type="submit"
                          className="shrink-0 rounded-lg bg-white/15 px-2.5 text-[0.78rem] text-white disabled:opacity-40"
                          disabled={pending || !rosterNameDraft.trim()}
                        >
                          Add
                        </button>
                      </form>
                    ) : rosterMenuMode === "rename" ? (
                      <form
                        className="flex gap-1.5 px-1.5 py-1.5"
                        onSubmit={(event) => {
                          event.preventDefault();
                          handleRenameRoster();
                        }}
                      >
                        <input
                          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1.5 text-[0.82rem] text-white"
                          value={rosterNameDraft}
                          autoFocus
                          placeholder="Roster name"
                          maxLength={80}
                          onChange={(event) => setRosterNameDraft(event.target.value)}
                        />
                        <button
                          type="submit"
                          className="shrink-0 rounded-lg bg-white/15 px-2.5 text-[0.78rem] text-white disabled:opacity-40"
                          disabled={pending || !rosterNameDraft.trim()}
                        >
                          Save
                        </button>
                      </form>
                    ) : rosterMenuMode === "delete" ? (
                      <div className="flex items-center gap-1.5 px-1.5 py-1.5">
                        <p className="m-0 min-w-0 flex-1 text-[0.78rem] text-white/55">
                          Delete “{activeRoster?.name}”?
                        </p>
                        <button
                          type="button"
                          className="shrink-0 rounded-lg px-2.5 py-1.5 text-[0.78rem] text-white/60 hover:bg-white/[0.06]"
                          onClick={() => setRosterMenuMode(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded-lg bg-[#f0a8a8]/20 px-2.5 py-1.5 text-[0.78rem] text-[#f0a8a8] disabled:opacity-40"
                          disabled={pending}
                          onClick={handleDeleteRoster}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          className="w-full rounded-xl px-2.5 py-2 text-left text-[0.82rem] text-white/75 hover:bg-white/[0.06] hover:text-white"
                          onClick={() => {
                            setRosterMenuMode("create");
                            setRosterNameDraft("");
                          }}
                        >
                          Add roster
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="w-full rounded-xl px-2.5 py-2 text-left text-[0.82rem] text-white/75 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                          disabled={!activeRoster}
                          onClick={() => {
                            setRosterMenuMode("rename");
                            setRosterNameDraft(activeRoster?.name || "");
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="w-full rounded-xl px-2.5 py-2 text-left text-[0.82rem] text-white/75 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                          disabled={!activeRoster || pending}
                          onClick={handleDuplicateRoster}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="w-full rounded-xl px-2.5 py-2 text-left text-[0.82rem] text-white/75 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                          disabled={!activeRoster || pending}
                          onClick={handleToggleTemplate}
                        >
                          {activeRoster?.isTemplate ? "Unset template" : "Mark as template"}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="w-full rounded-xl px-2.5 py-2 text-left text-[0.82rem] text-[#f0a8a8] hover:bg-white/[0.06] disabled:opacity-40"
                          disabled={!activeRoster}
                          onClick={() => setRosterMenuMode("delete")}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={topBtnClass}
            disabled={!activeRosterId || pending}
            onClick={() => fileInputRef.current?.click()}
          >
            Import CSV
          </button>
          <button
            type="button"
            className={topBtnClass}
            disabled={!activeRosterId || pending}
            onClick={handleSeedFromHelo}
            title="Add players from HeLO match participants (no site access)"
          >
            {seedFromHelo.isPending ? "Seeding…" : "Seed from HeLO"}
          </button>
          <button
            type="button"
            className={topBtnClass}
            disabled={!activeRosterId || members.length === 0}
            onClick={() => exportMembersCsv(members, activeRoster?.name)}
          >
            Export CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCsvFile}
          />
          </div>
        </div>
      </header>

      {error ? <p className="mt-2 shrink-0 text-[0.82rem] text-[#f0a8a8]">{error}</p> : null}
      {importMessage ? <p className="mt-2 shrink-0 text-[0.82rem] text-white/55">{importMessage}</p> : null}

      <div
        className={[
          "mt-4 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          cardOpen
            ? "grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]"
            : "grid-cols-1 gap-0",
        ].join(" ")}
      >
        <div className="glass-surface flex min-h-0 flex-col overflow-hidden rounded-[1.375rem] border border-white/10 bg-white/[0.055] p-4">
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="m-0 truncate text-[0.95rem] font-medium text-white">
                {filtered.length === members.length
                  ? `Total ${members.length}`
                  : `Total ${filtered.length} out of ${members.length}`}
              </h3>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
              {showFilters ? (
                <div className="flex max-w-[min(42rem,75vw)] flex-wrap items-center justify-end gap-1.5">
                  <FilterDropdown
                    label="Status"
                    options={COMP_STATUSES}
                    selected={filterStatuses}
                    onToggle={toggleFilterStatus}
                  />
                  <FilterDropdown
                    label="Situation"
                    options={COMP_SITUATIONS}
                    selected={filterSituations}
                    onToggle={toggleFilterSituation}
                  />
                  <FilterDropdown
                    label="Role"
                    options={COMP_ROLES}
                    selected={filterRoles}
                    onToggle={toggleFilterRole}
                  />
                  <FilterDropdown
                    label="Tournament"
                    options={tournamentOptions.map((name) => ({ id: name, label: name }))}
                    selected={filterTournaments}
                    onToggle={toggleFilterTournament}
                  />
                  <button
                    type="button"
                    className="rounded-full border border-white/10 px-2.5 py-1 text-[0.7rem] text-white/55 hover:bg-white/[0.06] hover:text-white"
                    onClick={() => setFilterStatuses([...DEFAULT_VISIBLE_STATUSES])}
                  >
                    Pool only
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/10 px-2.5 py-1 text-[0.7rem] text-white/55 hover:bg-white/[0.06] hover:text-white"
                    onClick={() => setFilterStatuses([])}
                  >
                    Show all
                  </button>
                </div>
              ) : null}
              <IconButton
                label="Filter by status, situation, role, or tournament"
                onClick={() => setShowFilters((v) => !v)}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle
                    cx="12"
                    cy="12"
                    r="8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    className={
                      showFilters ||
                      filterStatuses.length !== DEFAULT_VISIBLE_STATUSES.length ||
                      filterSituations.length ||
                      filterRoles.length ||
                      filterTournaments.length
                        ? "opacity-100"
                        : "opacity-80"
                    }
                  />
                  <path
                    d="M8 9.5h8l-2.6 3.1v2.8L11 16.5v-3.9L8 9.5Z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                    fill={
                      showFilters ||
                      filterStatuses.length !== DEFAULT_VISIBLE_STATUSES.length ||
                      filterSituations.length ||
                      filterRoles.length ||
                      filterTournaments.length
                        ? "currentColor"
                        : "none"
                    }
                    fillOpacity="0.25"
                  />
                </svg>
              </IconButton>
              {showSearch ? (
                <input
                  type="search"
                  className={`${fieldClass} w-[min(180px,40vw)]`}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  autoFocus
                />
              ) : null}
              <IconButton label="Search members" onClick={() => setShowSearch((v) => !v)}>
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </IconButton>
              <IconButton label="Add member" onClick={() => setShowAdd((v) => !v)}>
                <span className="text-base leading-none">+</span>
              </IconButton>
            </div>
          </div>

          {showAdd ? (
            <form className="mb-3 flex shrink-0 flex-wrap gap-2" onSubmit={handleAdd}>
              <input
                required
                className={fieldClass}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Name"
                maxLength={80}
              />
              <input
                required
                className={fieldClass}
                value={steamId}
                onChange={(event) => setSteamId(event.target.value)}
                placeholder="Steam ID"
              />
              <input
                className={fieldClass}
                value={t17Id}
                onChange={(event) => setT17Id(event.target.value)}
                placeholder={`T17 ID (${T17_ID_LENGTH} chars)`}
                maxLength={T17_ID_LENGTH}
              />
              <button type="submit" className="glass-control" disabled={pending || !activeRosterId}>
                Add
              </button>
            </form>
          ) : null}

          {!activeRosterId ? (
            <p className="my-8 text-center text-[0.92rem] text-white/45">Select or create a roster.</p>
          ) : membersQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <RosterTable
              members={filtered}
              selectedId={selectedId}
              tournamentOptions={tournamentOptions}
              onOpenCard={(member) => setSelectedId(member.id)}
              onSetRoles={handleSetRoles}
              onSetSituation={handleSetSituation}
              onSetStatus={handleSetStatus}
              onSetTournaments={handleSetTournaments}
              onSetT17Id={handleSetT17Id}
              onSetDisplayName={handleSetDisplayName}
              onRemoveMember={handleRemoveMember}
              actionPending={pending}
            />
          )}
        </div>

        <div
          className={[
            "min-h-0 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            cardOpen
              ? "max-h-[100%] translate-x-0 opacity-100"
              : "pointer-events-none max-h-0 translate-x-8 opacity-0 lg:max-h-none lg:w-0 lg:translate-x-6 lg:opacity-0",
          ].join(" ")}
        >
          {cardOpen ? (
            <PlayerCard
              member={selected}
              dossier={selectedDossier}
              onClose={() => setSelectedId(null)}
              onSetStatus={(status) => handleSetStatus(selected, status)}
              statusPending={updateMember.isPending}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
