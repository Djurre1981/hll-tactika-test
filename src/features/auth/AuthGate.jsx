import { createContext, useContext } from "react";
import { ApiError } from "../../lib/api-client.js";
import { Button } from "../../shared/Button.jsx";
import { Spinner } from "../../shared/Spinner.jsx";
import { useAuthQuery, useLogoutMutation } from "./hooks/useAuthQuery.js";

const AuthContext = createContext(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthGate");
  }
  return value;
}

function AuthFrame({ title, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-text">
      <section className="w-full max-w-md rounded border border-border bg-surface p-6 shadow-lg">
        <h1 className="text-xl font-semibold">{title}</h1>
        <div className="mt-4 text-sm text-muted">{children}</div>
      </section>
    </div>
  );
}

export function AuthGate({ children }) {
  const auth = useAuthQuery();
  const logout = useLogoutMutation();

  if (auth.isLoading) {
    return (
      <AuthFrame title="Checking session">
        <div className="flex items-center gap-3">
          <Spinner />
          <span>Loading your Tactika session...</span>
        </div>
      </AuthFrame>
    );
  }

  if (auth.error instanceof ApiError && auth.error.status === 401) {
    return (
      <AuthFrame title="Sign in required">
        <p>Use Steam to access Tactika v2.</p>
        <Button className="mt-4" onClick={() => window.location.assign("/api/auth/steam")}>
          Sign in with Steam
        </Button>
      </AuthFrame>
    );
  }

  if (auth.error instanceof ApiError && auth.error.status === 403) {
    return (
      <AuthFrame title="Access denied">
        <p>Your Steam account is authenticated but is not on the Tactika roster.</p>
        <Button className="mt-4" onClick={() => logout.mutate()} disabled={logout.isPending}>
          Try another account
        </Button>
      </AuthFrame>
    );
  }

  if (auth.error) {
    return (
      <AuthFrame title="Authentication failed">
        <p>{auth.error.message || "Unable to load your session."}</p>
      </AuthFrame>
    );
  }

  return <AuthContext.Provider value={auth.data}>{children}</AuthContext.Provider>;
}
