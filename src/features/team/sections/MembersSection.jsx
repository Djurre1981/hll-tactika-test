import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthGate.jsx";
import { GlassSelect } from "../../../shared/GlassSelect.jsx";
import { Spinner } from "../../../shared/Spinner.jsx";
import { RosterTable } from "../RosterTable.jsx";
import {
  useAddTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useTeamQuery,
  useUpdateTeamMemberRoleMutation,
} from "../hooks/useTeamQuery.js";

const ROLE_FILTERS = ["all", "owner", "admin", "assist", "editor", "viewer"];
const roleFilterOptions = ROLE_FILTERS.map((role) => ({ value: role, label: role }));

export function MembersSection() {
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
    [users, roleFilter],
  );
  const actionPending = addMember.isPending || updateRole.isPending || removeMember.isPending;
  const error =
    team.error?.message ||
    addMember.error?.message ||
    updateRole.error?.message ||
    removeMember.error?.message;

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
    if (window.confirm("Remove this member from website access?")) {
      removeMember.mutate(targetSteamId);
    }
  }

  return (
    <div className="glass-scroll flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-1 py-1">
      <header>
        <h1 className="m-0 text-[clamp(1.35rem,2vw,1.75rem)] font-medium tracking-wide text-white">
          Website Members Roles
        </h1>
        <p className="m-0 mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-white/50">
          Site allowlist and roles. Independent from Management competition rosters — edit access
          only here.
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-3" onSubmit={handleAdd}>
        <label className="min-w-[14rem] flex-1 text-sm text-white/55">
          <span className="mb-1 block tracking-[0.08em]">Steam ID64</span>
          <input
            className="glass-input w-full"
            value={steamId}
            onChange={(event) => setSteamId(event.target.value)}
            placeholder="7656119..."
            inputMode="numeric"
          />
        </label>
        <button type="submit" className="glass-control" disabled={!steamId.trim() || actionPending}>
          Add people
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-3 text-sm text-white/55">
          Filter role
          <GlassSelect
            className="min-w-[7rem]"
            value={roleFilter}
            onChange={setRoleFilter}
            placeholder=""
            options={roleFilterOptions}
          />
        </label>
        <span className="text-sm text-white/45">
          {filteredUsers.length} of {users.length} members
        </span>
      </div>

      {error ? <p className="m-0 text-[0.82rem] text-[#f0a8a8]">{error}</p> : null}

      {team.isLoading ? (
        <div className="flex items-center gap-3 text-white/55">
          <Spinner />
          <span>Loading members…</span>
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
    </div>
  );
}
