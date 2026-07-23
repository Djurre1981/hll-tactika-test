import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthGate.jsx";
import { useLogoutMutation } from "../../auth/hooks/useAuthQuery.js";
import { canManageTeam } from "../../../lib/roles.js";
import { HelpWikiButton } from "../../help/HelpWikiButton.jsx";
import { userMenuPill } from "./editorUi.js";

/** Same chrome as home HubUserMenu — help + avatar + glass pill menu. */
export function EditorUserCluster() {
  const user = useAuth();
  const logout = useLogoutMutation();
  const name = user.name || user.steamId;

  return (
    <div className="relative flex items-start gap-[0.65rem]">
      <div className="flex items-center gap-[0.65rem]">
        <HelpWikiButton />
        <div className="group relative flex items-center">
          <div
            className="pointer-events-none invisible absolute right-full top-0 flex w-max flex-col items-stretch gap-[0.35rem] pr-[0.65rem] group-hover:pointer-events-auto group-hover:visible group-focus-within:pointer-events-auto group-focus-within:visible"
            role="menu"
          >
            {canManageTeam(user.role) ? (
              <Link className={userMenuPill} to="/team" role="menuitem">
                Admin Panel
              </Link>
            ) : null}
            <button
              type="button"
              className={userMenuPill}
              role="menuitem"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              Sign out
            </button>
          </div>
          <button
            type="button"
            aria-label="Account"
            className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-solid border-white/[0.18] bg-white/[0.06] backdrop-blur-[20px] backdrop-saturate-[160%] transition hover:border-white/[0.32] hover:shadow-[0_0_20px_rgba(255,255,255,0.08)]"
          >
            {user.avatar ? (
              <img src={user.avatar} alt="" className="h-full w-full object-cover" width={40} height={40} />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs text-white/60">
                {(name || "?").slice(0, 1)}
              </span>
            )}
          </button>
        </div>
      </div>
      <span className="sr-only">{name}</span>
    </div>
  );
}
