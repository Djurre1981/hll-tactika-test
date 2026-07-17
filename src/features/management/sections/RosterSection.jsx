import { useMemo, useState } from "react";
import { Spinner } from "../../../shared/Spinner.jsx";
import { ManagementRosterTable, ROLE_LABELS } from "../ManagementRosterTable.jsx";
import {
  useAddRosterMemberMutation,
  useRemoveRosterMemberMutation,
  useRosterQuery,
} from "../hooks/useRosterQuery.js";

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
    <section className="mgmt-section">
      <header className="mgmt-section__header">
        <div>
          <h2 className="mgmt-section__title">Roster</h2>
          <p className="mgmt-section__sub">Clan members — not website access.</p>
        </div>
        <div className="mgmt-section__tools">
          <label className="mgmt-search">
            <span className="sr-only">Search roster</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
            />
          </label>
          <button
            type="button"
            className="mgmt-icon-btn mgmt-icon-btn--round"
            onClick={() => setShowForm((open) => !open)}
          >
            +
          </button>
        </div>
      </header>

      {showForm ? (
        <form className="mgmt-form" onSubmit={handleAdd}>
          <input
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Display name"
            maxLength={80}
          />
          <input
            value={steamId}
            onChange={(event) => setSteamId(event.target.value)}
            placeholder="Steam ID (optional)"
          />
          <select value={rosterRole} onChange={(event) => setRosterRole(event.target.value)}>
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
