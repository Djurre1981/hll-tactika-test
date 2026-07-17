import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthGate.jsx";
import { Button } from "../../shared/Button.jsx";
import { Spinner } from "../../shared/Spinner.jsx";
import { RosterTable } from "./RosterTable.jsx";
import {
  useAddTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useTeamQuery,
  useUpdateTeamMemberRoleMutation,
} from "./hooks/useTeamQuery.js";

const ROLE_FILTERS = ["all", "owner", "admin", "assist", "editor", "viewer"];

export function TeamPage() {
  const currentUser = useAuth();
  const [roleFilter, setRoleFilter] = useState("all");
  const [steamId, setSteamId] = useState("");
  const team = useTeamQuery();
  const addMember = useAddTeamMemberMutation();
  const updateRole = useUpdateTeamMemberRoleMutation();
  const removeMember = useRemoveTeamMemberMutation();
  const users = team.data?.users || [];
  const filteredUsers = useMemo(
    () => users.filter((user) => roleFilter === "all" || user.role === roleFilter),
    [users, roleFilter]
  );
  const actionPending = addMember.isPending || updateRole.isPending || removeMember.isPending;

  function handleAdd(event) {
    event.preventDefault();
    addMember.mutate(steamId.trim(), {
      onSuccess: () => setSteamId(""),
    });
  }

  function handleRoleChange(targetSteamId, role) {
    updateRole.mutate({ steamId: targetSteamId, role });
  }

  function handleRemove(targetSteamId) {
    if (window.confirm("Remove this member from the roster?")) {
      removeMember.mutate(targetSteamId);
    }
  }

  const error =
    team.error?.message ||
    addMember.error?.message ||
    updateRole.error?.message ||
    removeMember.error?.message;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="mt-2 text-muted">Staff roster and access management.</p>
        </div>
        <form className="flex flex-wrap items-end gap-2" onSubmit={handleAdd}>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Steam ID64</span>
            <input
              className="rounded border border-border bg-surface px-3 py-2 text-text"
              value={steamId}
              onChange={(event) => setSteamId(event.target.value)}
              placeholder="7656119..."
              inputMode="numeric"
            />
          </label>
          <Button type="submit" disabled={!steamId.trim() || actionPending}>
            Add member
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted" htmlFor="role-filter">
          Filter role
        </label>
        <select
          id="role-filter"
          className="rounded border border-border bg-surface px-3 py-2 text-text"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
        >
          {ROLE_FILTERS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted">
          {filteredUsers.length} of {users.length} members
        </span>
      </div>

      {error ? (
        <p className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {team.isLoading ? (
        <div className="flex items-center gap-3 text-muted">
          <Spinner />
          <span>Loading roster...</span>
        </div>
      ) : (
        <RosterTable
          users={filteredUsers}
          currentRole={currentUser.role}
          onRoleChange={handleRoleChange}
          onRemove={handleRemove}
          actionPending={actionPending}
        />
      )}
    </section>
  );
}
