import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthGate.jsx";
import { useLogoutMutation } from "../auth/hooks/useAuthQuery.js";

function canManageTeam(role) {
  return role === "admin" || role === "owner";
}

const menuItemClass =
  "inline-flex min-h-10 w-full items-center justify-center rounded-full border border-white/12 bg-white/[0.07] px-3.5 py-1.5 text-[0.72rem] font-light uppercase tracking-[0.1em] text-white/85 shadow-glass backdrop-blur-xl transition hover:bg-white/15 hover:text-white";

export function HubUserMenu() {
  const user = useAuth();
  const logout = useLogoutMutation();
  const name = user.name || user.steamId;

  return (
    <div className="fixed right-6 top-6 z-40 flex animate-[hub-chrome-enter_0.6s_cubic-bezier(0.22,1,0.36,1)_0.08s_both] items-start gap-2.5">
      <div className="group relative flex items-center">
        <div className="invisible pointer-events-none absolute right-full top-0 flex w-max flex-col items-stretch gap-1.5 pr-2.5 transition-[visibility] group-hover:visible group-hover:pointer-events-auto group-focus-within:visible group-focus-within:pointer-events-auto">
          {canManageTeam(user.role) ? (
            <Link className={menuItemClass} to="/team" role="menuitem">
              Admin Panel
            </Link>
          ) : null}
          <button
            type="button"
            className={menuItemClass}
            role="menuitem"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            Sign out
          </button>
        </div>
        <button
          type="button"
          className="h-10 w-10 overflow-hidden rounded-full border border-white/15 p-0"
          aria-label="Account"
        >
          {user.avatar ? (
            <img className="h-full w-full object-cover" src={user.avatar} alt="" width={40} height={40} />
          ) : (
            <span className="block h-full w-full bg-white/10" aria-hidden="true" />
          )}
        </button>
      </div>
      <span className="pt-2 text-[0.78rem] font-light tracking-wide text-white/70">{name}</span>
    </div>
  );
}
