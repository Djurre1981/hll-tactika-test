import { Button } from "../../shared/Button.jsx";
import { useAuth } from "./AuthGate.jsx";
import { useLogoutMutation } from "./hooks/useAuthQuery.js";

export function UserMenu() {
  const user = useAuth();
  const logout = useLogoutMutation();
  const name = user.name || user.steamId;

  return (
    <div className="ml-auto flex items-center gap-3 text-sm">
      {user.avatar ? (
        <img
          src={user.avatar}
          alt=""
          className="h-8 w-8 rounded-full border border-border object-cover"
        />
      ) : (
        <div className="h-8 w-8 rounded-full border border-border bg-bg" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <div className="max-w-40 truncate font-medium">{name}</div>
        <div className="text-xs uppercase tracking-wide text-accent">{user.role}</div>
      </div>
      <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
        Logout
      </Button>
    </div>
  );
}
