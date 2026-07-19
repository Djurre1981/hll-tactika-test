import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthGate.jsx";
import { useLogoutMutation } from "../auth/hooks/useAuthQuery.js";
import { canManageTeam } from "../../lib/roles.js";
import { userMenuPill } from "../../shared/glassUi.js";
import { OnlineNow } from "./OnlineNow.jsx";
import { usePresenceMembersQuery } from "./hooks/usePresenceMembersQuery.js";
import { useSitePresence } from "./hooks/useSitePresence.js";

/**
 * Profile chip (top-right) + presence bubbles under the avatar,
 * horizontally centered on the avatar and vertically mid-dashboard.
 */
export function HubUserMenu() {
  const user = useAuth();
  const logout = useLogoutMutation();
  const name = user.name || user.steamId;
  const presence = useSitePresence();
  const membersQuery = usePresenceMembersQuery(Boolean(user?.steamId));
  const members = membersQuery.data?.users || [];

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 top-6 z-40 flex w-10 flex-col items-center">
      <div className="pointer-events-auto relative flex shrink-0 animate-[hub-chrome-enter_0.6s_cubic-bezier(0.22,1,0.36,1)_0.08s_both] flex-col items-center">
        <div className="group relative flex items-center">
          <div className="invisible pointer-events-none absolute right-full top-0 flex w-max flex-col items-stretch gap-1 pr-2.5 transition-[visibility] group-hover:visible group-hover:pointer-events-auto group-focus-within:visible group-focus-within:pointer-events-auto">
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
            className="h-10 w-10 overflow-hidden rounded-full border border-white/15 p-0"
            aria-label="Account"
          >
            {user.avatar ? (
              <img
                className="h-full w-full object-cover"
                src={user.avatar}
                alt=""
                width={40}
                height={40}
              />
            ) : (
              <span className="block h-full w-full bg-white/10" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-4">
        <OnlineNow
          peers={presence.peers}
          members={members}
          status={presence.status}
          selfSteamId={user.steamId}
          selfName={name}
          selfAvatar={user.avatar}
        />
      </div>
    </div>
  );
}
