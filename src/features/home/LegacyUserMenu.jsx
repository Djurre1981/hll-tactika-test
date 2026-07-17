import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthGate.jsx";
import { useLogoutMutation } from "../auth/hooks/useAuthQuery.js";

function canManageTeam(role) {
  return role === "admin" || role === "owner";
}

export function LegacyUserMenu() {
  const user = useAuth();
  const location = useLocation();
  const logout = useLogoutMutation();
  const name = user.name || user.steamId;
  const onHome = location.pathname === "/home";

  return (
    <div className="user-cluster">
      <div className="user-cluster__avatar-wrap">
        <div className="user-cluster__menu" role="menu">
          {!onHome ? (
            <Link className="user-cluster__signout" to="/home" role="menuitem">
              Dashboard
            </Link>
          ) : null}
          {canManageTeam(user.role) ? (
            <Link className="user-cluster__admin" to="/team" role="menuitem">
              Admin Panel
            </Link>
          ) : null}
          <button
            type="button"
            className="user-cluster__signout"
            role="menuitem"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            Sign out
          </button>
        </div>
        <button type="button" className="user-cluster__avatar-btn" aria-label="Account">
          {user.avatar ? (
            <img className="user-cluster__avatar" src={user.avatar} alt="" width={40} height={40} />
          ) : (
            <span className="user-cluster__avatar" aria-hidden="true" />
          )}
        </button>
      </div>
      <span className="user-cluster__name">{name}</span>
    </div>
  );
}
