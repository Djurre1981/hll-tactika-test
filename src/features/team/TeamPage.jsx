import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthGate.jsx";
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
      <header className="dashboard-page__header">
        <h1 className="dashboard-page__greeting">Admin Panel</h1>
        <p className="dashboard-page__tagline">
          {isOwner
            ? "Add or remove circle members. Owners can change roles, export pin backups, and test Discord alerts."
            : "Add or remove circle members and manage access."}
        </p>
      </header>

      {isOwner ? (
        <div className="hub-admin-actions">
          <button
            type="button"
            className="hub-admin-action"
            onClick={handleExportPins}
            disabled={actionPending}
          >
            Export full pin backup
          </button>
          <button
            type="button"
            className="hub-admin-action"
            onClick={handleTestAlert}
            disabled={actionPending}
          >
            Test Discord alert
          </button>
        </div>
      ) : null}

      {actionStatus.message ? (
        <p className={`hub-admin-status${actionStatus.isError ? " is-error" : ""}`}>
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
          className="hub-admin-action"
          disabled={!steamId.trim() || actionPending}
        >
          Add member
        </button>
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-white/55" htmlFor="role-filter">
          Filter role
        </label>
        <select
          id="role-filter"
          className="glass-input"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
        >
          {ROLE_FILTERS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <span className="text-sm text-white/45">
          {filteredUsers.length} of {users.length} members
        </span>
      </div>

      {error ? (
        <p className="hub-admin-status is-error mb-3">{error}</p>
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
    return <div className="hub-admin-shell">{content}</div>;
  }

  return <section className="space-y-6">{content}</section>;
}
