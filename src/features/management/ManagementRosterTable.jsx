const STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
  trial: "Trial",
};

const ROLE_LABELS = {
  commander: "Commander",
  sl: "SL",
  member: "Member",
  reserve: "Reserve",
  coach: "Coach",
};

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function ManagementRosterTable({ members, onRemove, actionPending = false }) {
  if (members.length === 0) {
    return <p className="mgmt-empty">No roster members yet.</p>;
  }

  return (
    <div className="mgmt-table-wrap">
      <table className="mgmt-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>
                <div className="mgmt-person">
                  <span className="mgmt-avatar" aria-hidden="true">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt="" />
                    ) : (
                      initials(member.displayName)
                    )}
                  </span>
                  <span className="mgmt-person__text">
                    <span className="mgmt-person__name">{member.displayName}</span>
                    {member.steamId ? (
                      <span className="mgmt-person__sub">#{member.steamId}</span>
                    ) : (
                      <span className="mgmt-person__sub">No Steam ID</span>
                    )}
                  </span>
                </div>
              </td>
              <td>
                <span className="mgmt-pill">
                  <span className="mgmt-pill__dot" />
                  {ROLE_LABELS[member.rosterRole] || "—"}
                </span>
              </td>
              <td>
                <span
                  className={`mgmt-pill${member.status === "active" ? " is-positive" : ""}`}
                >
                  <span className="mgmt-pill__dot" />
                  {STATUS_LABELS[member.status] || member.status}
                </span>
              </td>
              <td className="mgmt-table__actions">
                <button
                  type="button"
                  className="mgmt-icon-btn"
                  disabled={actionPending}
                  aria-label={`Remove ${member.displayName}`}
                  onClick={() => onRemove(member)}
                >
                  ···
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { ROLE_LABELS, STATUS_LABELS };
