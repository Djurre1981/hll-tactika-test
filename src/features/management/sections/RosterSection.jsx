import { useMemo, useState } from "react";
import { Spinner } from "../../../shared/Spinner.jsx";
import { ManagementRosterTable, ROLE_LABELS } from "../ManagementRosterTable.jsx";
import {
  useAddRosterMemberMutation,
  useRemoveRosterMemberMutation,
  useRosterQuery,
} from "../hooks/useRosterQuery.js";

const fieldClass =
  "min-h-[2.4rem] min-w-[10rem] rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-2 text-white/90";

export function RosterSection() {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [steamId, setSteamId] = useState("");
  const [rosterRole, setRosterRole] = useState("member");
  const roster = useRosterQuery();
  const addMember = useAddRosterMemberMutation();
  const removeMember = useRemoveRosterMemberMutation();
  const members = roster.data?.members || [];

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

  function handleAdd(event) {
    event.preventDefault();
    addMember.mutate(
      {
        displayName: displayName.trim(),
        steamId: steamId.trim() || null,
        rosterRole,
        status: "active",
      },
      {
        onSuccess: () => {
          setDisplayName("");
          setSteamId("");
          setRosterRole("member");
          setShowForm(false);
        },
      },
    );
  }

  function handleRemove(member) {
    if (!window.confirm(`Remove ${member.displayName} from the clan roster?`)) return;
    removeMember.mutate(member.id);
  }

  const pending = addMember.isPending || removeMember.isPending;
  const error = roster.error?.message || addMember.error?.message || removeMember.error?.message;

  return (
    <section>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-[1.65rem] font-medium tracking-wide text-white">Roster</h2>
          <p className="mt-1.5 text-[0.9rem] text-white/50">Clan members — not website access.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <label>
            <span className="sr-only">Search roster</span>
            <input
              type="search"
              className={`${fieldClass} w-[min(220px,42vw)] min-w-0`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
            />
          </label>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[0.05] text-lg text-white/55 transition hover:text-white"
            onClick={() => setShowForm((open) => !open)}
          >
            +
          </button>
        </div>
      </header>

      {showForm ? (
        <form className="mb-4 flex flex-wrap gap-2.5" onSubmit={handleAdd}>
          <input
            required
            className={fieldClass}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Display name"
            maxLength={80}
          />
          <input
            className={fieldClass}
            value={steamId}
            onChange={(event) => setSteamId(event.target.value)}
            placeholder="Steam ID (optional)"
          />
          <select
            className={fieldClass}
            value={rosterRole}
            onChange={(event) => setRosterRole(event.target.value)}
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className="hub-admin-action" disabled={pending}>
            Add
          </button>
        </form>
      ) : null}

      {error ? <p className="hub-admin-status is-error">{error}</p> : null}

      {roster.isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <ManagementRosterTable
          members={filtered}
          onRemove={handleRemove}
          actionPending={pending}
        />
      )}
    </section>
  );
}
