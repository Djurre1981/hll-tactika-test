import { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "../../../shared/Spinner.jsx";
import { RosterDetailPanel } from "../RosterDetailPanel.jsx";
import { RosterMemberList } from "../RosterMemberList.jsx";
import {
  useAddRosterMemberToRosterMutation,
  useCreateRosterMutation,
  useImportRosterCsvMutation,
  useRemoveMemberFromRosterMutation,
  useRosterMembersQuery,
  useRostersQuery,
} from "../hooks/useRostersQuery.js";

const fieldClass =
  "min-h-[2.4rem] min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-2 text-white/90";

function IconButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[0.05] text-white/60 transition hover:bg-white/[0.1] hover:text-white"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function RosterSection() {
  const [activeRosterId, setActiveRosterId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showCreateRoster, setShowCreateRoster] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [steamId, setSteamId] = useState("");
  const [newRosterName, setNewRosterName] = useState("");
  const [newTournament, setNewTournament] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef(null);

  const rostersQuery = useRostersQuery();
  const rosters = rostersQuery.data?.rosters || [];

  useEffect(() => {
    if (!activeRosterId && rosters.length > 0) {
      setActiveRosterId(rosters[0].id);
    }
  }, [activeRosterId, rosters]);

  const membersQuery = useRosterMembersQuery(activeRosterId);
  const createRoster = useCreateRosterMutation();
  const addMember = useAddRosterMemberToRosterMutation(activeRosterId);
  const removeMember = useRemoveMemberFromRosterMutation(activeRosterId);
  const importCsv = useImportRosterCsvMutation(activeRosterId);

  const members = membersQuery.data?.members || [];
  const activeRoster = rosters.find((r) => r.id === activeRosterId) || null;
  const selected = members.find((m) => m.id === selectedId) || null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) => {
      const haystack = [member.displayName, member.steamId, member.rosterRole, member.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [members, query]);

  useEffect(() => {
    setSelectedId(null);
    setImportMessage("");
  }, [activeRosterId]);

  function handleCreateRoster(event) {
    event.preventDefault();
    const name = newRosterName.trim();
    if (!name) return;
    createRoster.mutate(
      { name, tournament: newTournament.trim() || null },
      {
        onSuccess: (data) => {
          setNewRosterName("");
          setNewTournament("");
          setShowCreateRoster(false);
          if (data?.roster?.id) setActiveRosterId(data.roster.id);
        },
      },
    );
  }

  function handleAdd(event) {
    event.preventDefault();
    if (!activeRosterId) return;
    addMember.mutate(
      {
        displayName: displayName.trim(),
        steamId: steamId.trim(),
        status: "active",
      },
      {
        onSuccess: () => {
          setDisplayName("");
          setSteamId("");
          setShowAdd(false);
        },
      },
    );
  }

  function handleRemove(member) {
    if (!window.confirm(`Remove ${member.displayName} from this roster?`)) return;
    removeMember.mutate(member.id, {
      onSuccess: () => {
        if (selectedId === member.id) setSelectedId(null);
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
    addMember.isPending ||
    removeMember.isPending ||
    importCsv.isPending;

  const error =
    rostersQuery.error?.message ||
    membersQuery.error?.message ||
    createRoster.error?.message ||
    addMember.error?.message ||
    removeMember.error?.message ||
    importCsv.error?.message;

  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[1.65rem] font-medium tracking-wide text-white">Roster editor</h2>
          <p className="mt-1.5 text-[0.9rem] text-white/50">
            Tournament rosters — members can belong to more than one.
          </p>
        </div>
        <button
          type="button"
          className="glass-control"
          onClick={() => setShowCreateRoster((open) => !open)}
        >
          New roster
        </button>
      </header>

      {showCreateRoster ? (
        <form className="glass-surface flex flex-wrap gap-2.5 p-3" onSubmit={handleCreateRoster}>
          <input
            required
            className={fieldClass}
            value={newRosterName}
            onChange={(event) => setNewRosterName(event.target.value)}
            placeholder="Roster name"
            maxLength={80}
          />
          <input
            className={fieldClass}
            value={newTournament}
            onChange={(event) => setNewTournament(event.target.value)}
            placeholder="Tournament (optional)"
            maxLength={120}
          />
          <button type="submit" className="glass-control" disabled={pending}>
            Create
          </button>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {rostersQuery.isLoading ? (
          <Spinner />
        ) : rosters.length === 0 ? (
          <p className="m-0 text-[0.9rem] text-white/45">No rosters yet — create one to start.</p>
        ) : (
          rosters.map((roster) => {
            const active = roster.id === activeRosterId;
            return (
              <button
                key={roster.id}
                type="button"
                className={[
                  "rounded-full border px-3.5 py-1.5 text-[0.85rem] transition",
                  active
                    ? "border-white/25 bg-white/15 text-white"
                    : "border-white/12 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white",
                ].join(" ")}
                onClick={() => setActiveRosterId(roster.id)}
              >
                {roster.name}
                {roster.tournament ? (
                  <span className="ml-1.5 text-white/40">· {roster.tournament}</span>
                ) : null}
                <span className="ml-1.5 text-white/35">({roster.memberCount})</span>
              </button>
            );
          })
        )}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,1fr)]">
        <div className="glass-panel flex min-h-[22rem] flex-col overflow-hidden p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="m-0 text-[1.2rem] font-medium text-white">
                {activeRoster?.name || "Members"}
              </h3>
              <p className="mt-1 text-[0.82rem] text-white/45">
                {activeRoster?.tournament
                  ? `Tournament · ${activeRoster.tournament}`
                  : `${filtered.length} member${filtered.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {showSearch ? (
                <input
                  type="search"
                  className={`${fieldClass} w-[min(200px,42vw)]`}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  autoFocus
                />
              ) : null}
              <IconButton label="Search members" onClick={() => setShowSearch((v) => !v)}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </IconButton>
              <IconButton label="Add member" onClick={() => setShowAdd((v) => !v)}>
                <span className="text-lg leading-none">+</span>
              </IconButton>
            </div>
          </div>

          {showAdd ? (
            <form className="mb-4 flex flex-wrap gap-2.5" onSubmit={handleAdd}>
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
              <button type="submit" className="glass-control" disabled={pending || !activeRosterId}>
                Add
              </button>
            </form>
          ) : null}

          {error ? <p className="mb-3 text-[0.82rem] text-[#f0a8a8]">{error}</p> : null}
          {importMessage ? (
            <p className="mb-3 text-[0.82rem] text-white/55">{importMessage}</p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto">
            {!activeRosterId ? (
              <p className="my-8 text-center text-[0.92rem] text-white/45">Select or create a roster.</p>
            ) : membersQuery.isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : (
              <RosterMemberList
                members={filtered}
                selectedId={selectedId}
                onSelect={(member) => setSelectedId(member.id)}
                onRemove={handleRemove}
                actionPending={pending}
              />
            )}
          </div>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              className="rounded-full border border-white/20 bg-white/[0.04] px-6 py-2.5 text-[0.88rem] text-white/85 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!activeRosterId || pending}
              onClick={() => fileInputRef.current?.click()}
            >
              Import roster from CSV
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

        <RosterDetailPanel member={selected} />
      </div>
    </section>
  );
}
