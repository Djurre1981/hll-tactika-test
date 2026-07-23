import { useMemo, useState } from "react";
import { Button } from "../../shared/Button.jsx";
import { GlassSelect } from "../../shared/GlassSelect.jsx";

const ROLES = ["viewer", "editor", "assist", "admin"];
const roleOptions = ROLES.map((role) => ({ value: role, label: role }));
const SORTERS = {
  name: (user) => user.name || user.steamId,
  steamId: (user) => user.steamId,
  role: (user) => user.role,
  lastSignedInAt: (user) => user.lastSignedInAt || "",
};

function formatDate(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SortButton({ column, sort, onSort, children }) {
  const active = sort.column === column;
  const marker = active ? (sort.direction === "asc" ? " ↑" : " ↓") : "";

  return (
    <button type="button" className="font-medium text-text" onClick={() => onSort(column)}>
      {children}
      {marker}
    </button>
  );
}

export function RosterTable({
  users,
  currentRole,
  onRoleChange,
  onRemove,
  actionPending = false,
}) {
  const [sort, setSort] = useState({ column: "role", direction: "asc" });
  const canEditRoles = currentRole === "owner";
  const sortedUsers = useMemo(() => {
    const getValue = SORTERS[sort.column] || SORTERS.name;
    return [...users].sort((a, b) => {
      const left = String(getValue(a)).toLowerCase();
      const right = String(getValue(b)).toLowerCase();
      const result = left.localeCompare(right);
      return sort.direction === "asc" ? result : -result;
    });
  }, [users, sort]);

  function handleSort(column) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" }
    );
  }

  if (sortedUsers.length === 0) {
    return <p className="rounded border border-border bg-surface p-4 text-muted">No members match.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-border bg-surface">
      <table className="min-w-full divide-y divide-border text-left text-sm">
        <thead className="bg-bg/60 text-muted">
          <tr>
            <th className="px-4 py-3">
              <SortButton column="name" sort={sort} onSort={handleSort}>
                Member
              </SortButton>
            </th>
            <th className="px-4 py-3">
              <SortButton column="steamId" sort={sort} onSort={handleSort}>
                Steam ID
              </SortButton>
            </th>
            <th className="px-4 py-3">
              <SortButton column="role" sort={sort} onSort={handleSort}>
                Role
              </SortButton>
            </th>
            <th className="px-4 py-3">
              <SortButton column="lastSignedInAt" sort={sort} onSort={handleSort}>
                Last sign-in
              </SortButton>
            </th>
            <th className="px-4 py-3 text-right">Controls</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sortedUsers.map((user) => (
            <tr key={user.steamId}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt=""
                      className="h-9 w-9 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full border border-border bg-bg" aria-hidden="true" />
                  )}
                  <span className="font-medium">{user.name || user.steamId || "Unknown member"}</span>
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted">{user.steamId}</td>
              <td className="px-4 py-3">
                {canEditRoles && user.roleEditable ? (
                  <GlassSelect
                    className="min-w-[6.5rem]"
                    value={user.role}
                    disabled={actionPending}
                    onChange={(value) => onRoleChange(user.steamId, value)}
                    placeholder=""
                    options={roleOptions}
                  />
                ) : (
                  <span className="rounded bg-bg px-2 py-1 text-xs uppercase tracking-wide text-accent">
                    {user.role}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-muted">{formatDate(user.lastSignedInAt)}</td>
              <td className="px-4 py-3 text-right">
                {user.removable ? (
                  <Button
                    variant="ghost"
                    disabled={actionPending}
                    onClick={() => onRemove(user.steamId)}
                  >
                    Remove
                  </Button>
                ) : (
                  <span className="text-muted">Locked</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
