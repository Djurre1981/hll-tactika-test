import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthGate.jsx";
import { GlassSelect } from "../../shared/GlassSelect.jsx";
import { Spinner } from "../../shared/Spinner.jsx";
import { RosterTable } from "./RosterTable.jsx";
import {
  useAddTeamMemberMutation,
  useExportPinsMutation,
  useRemoveTeamMemberMutation,
  useTeamQuery,
  useTestDiscordAlertMutation,
  useUpdateTeamMemberRoleMutation,
} from "./hooks/useTeamQuery.js";

const ROLE_FILTERS = ["all", "owner", "admin", "assist", "editor", "viewer"];
const roleFilterOptions = ROLE_FILTERS.map((role) => ({ value: role, label: role }));

export function TeamPage({ hub = false }) {
  const currentUser = useAuth();
  const [roleFilter, setRoleFilter] = useState("all");
  const [steamId, setSteamId] = useState("");
  const [actionStatus, setActionStatus] = useState({ message: "", isError: false });
  const team = useTeamQuery();
  const addMember = useAddTeamMemberMutation();
  const updateRole = useUpdateTeamMemberRoleMutation();
  const removeMember = useRemoveTeamMemberMutation();
  const exportPins = useExportPinsMutation();
  const testAlert = useTestDiscordAlertMutation();
  const users = team.data?.users || [];
  const isOwner = currentUser.role === "owner";
  const filteredUsers = useMemo(
    () => users.filter((user) => roleFilter === "all" || user.role === roleFilter),
    [users, roleFilter],
  );
  const actionPending =
    addMember.isPending ||
    updateRole.isPending ||
    removeMember.isPending ||
    exportPins.isPending ||
    testAlert.isPending;

  function handleAdd(event) {
    event.preventDefault();
    setActionStatus({ message: "", isError: false });
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

  function handleExportPins() {
    setActionStatus({ message: "Preparing backup…", isError: false });
    exportPins.mutate(undefined, {
      onSuccess: () => setActionStatus({ message: "Backup downloaded.", isError: false }),
      onError: (error) =>
        setActionStatus({ message: error.message || "Could not export pins", isError: true }),
    });
  }

  function handleTestAlert() {
    setActionStatus({ message: "Sending Discord probe…", isError: false });
    testAlert.mutate(undefined, {
      onSuccess: (result) => {
        const count = result.sent || result.webhookCount || 1;
        setActionStatus({
          message:
            count > 1
              ? `Discord probe sent to ${count} webhooks.`
              : "Discord probe sent. Check your alert channel.",
          isError: false,
        });
      },
      onError: (error) =>
        setActionStatus({ message: error.message || "Alert test failed", isError: true }),
    });
  }

  const error =
    team.error?.message ||
    addMember.error?.message ||
    updateRole.error?.message ||
    removeMember.error?.message;

  const content = (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[clamp(1.55rem,2.2vw,2rem)] font-medium tracking-wide text-white">
          Admin Panel
        </h1>
        <p className="m-0 max-w-xl text-[0.88rem] font-light tracking-wide text-white/50">
          {isOwner
            ? "Add or remove circle members. Owners can change roles, export pin backups, and test Discord alerts."
            : "Add or remove circle members and manage access."}
        </p>
      </header>

      {isOwner ? (
        <div className="mb-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            className="glass-control"
            onClick={handleExportPins}
            disabled={actionPending}
          >
            Export full pin backup
          </button>
          <button
            type="button"
            className="glass-control"
            onClick={handleTestAlert}
            disabled={actionPending}
          >
            Test Discord alert
          </button>
        </div>
      ) : null}

      {actionStatus.message ? (
        <p className={`mb-3 min-h-[1.2rem] text-[0.82rem] text-white/55${actionStatus.isError ? " text-[#f0a8a8]" : ""}`}>
          {actionStatus.message}
        </p>
      ) : null}

      <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={handleAdd}>
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
        <button
          type="submit"
          className="glass-control"
          disabled={!steamId.trim() || actionPending}
        >
          Add member
        </button>
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-3">
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

      {error ? (
        <p className="mb-3 min-h-[1.2rem] text-[0.82rem] text-[#f0a8a8]">{error}</p>
      ) : null}

      {team.isLoading ? (
        <div className="flex items-center gap-3 text-white/55">
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
    </>
  );

  if (hub) {
    return <div className="min-h-0 flex-1 overflow-auto">{content}</div>;
  }

  return <section className="space-y-6">{content}</section>;
}
