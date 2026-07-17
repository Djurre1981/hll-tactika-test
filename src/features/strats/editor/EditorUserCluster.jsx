import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthGate.jsx";
import { useLogoutMutation } from "../../auth/hooks/useAuthQuery.js";

/** Legacy-style top-right avatar with hover menu (Dashboard / Sign out). */
export function EditorUserCluster() {
  const user = useAuth();
  const logout = useLogoutMutation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {open && (
        <div className="absolute right-full top-0 mr-2 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="whitespace-nowrap rounded-lg border border-white/12 bg-[rgba(50,50,50,0.92)] px-3 py-2 text-left text-xs text-white/85 backdrop-blur-md hover:bg-white/10"
          >
            Dashboard
          </button>
          <button
            type="button"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
            className="whitespace-nowrap rounded-lg border border-white/12 bg-[rgba(50,50,50,0.92)] px-3 py-2 text-left text-xs text-white/85 backdrop-blur-md hover:bg-white/10 disabled:opacity-40"
          >
            Sign out
          </button>
        </div>
      )}
      <button
        type="button"
        aria-label="Account"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 overflow-hidden rounded-full border border-white/20 bg-black/50 shadow-lg"
      >
        {user.avatar ? (
          <img src={user.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-white/60">
            {(user.name || "?").slice(0, 1)}
          </span>
        )}
      </button>
    </div>
  );
}
