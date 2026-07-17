import { createContext, useContext, useState } from "react";
import { ApiError } from "../../lib/api-client.js";
import { Spinner } from "../../shared/Spinner.jsx";
import { ByePage } from "./ByePage.jsx";
import { WelcomePage } from "./WelcomePage.jsx";
import { useAuthQuery } from "./hooks/useAuthQuery.js";
import { useAuthQueryParams } from "./hooks/useAuthQueryParams.js";

const AuthContext = createContext(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthGate");
  }
  return value;
}

function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <div className="flex items-center gap-3 text-sm text-white/80">
        <Spinner />
        <span>Loading your Tactika session...</span>
      </div>
    </div>
  );
}

export function AuthGate({ children }) {
  const auth = useAuthQuery();
  const queryParams = useAuthQueryParams();
  const [forceWelcome, setForceWelcome] = useState(false);

  if (!queryParams.ready || auth.isLoading) {
    return <AuthLoading />;
  }

  if (auth.data?.authenticated) {
    return <AuthContext.Provider value={auth.data}>{children}</AuthContext.Provider>;
  }

  if (auth.error && !(auth.error instanceof ApiError && (auth.error.status === 401 || auth.error.status === 403))) {
    return (
      <WelcomePage
        authError={{
          message: auth.error.message || "Unable to load your session.",
          showLogin: false,
        }}
      />
    );
  }

  const showBye =
    !forceWelcome &&
    (queryParams.view === "bye" || (auth.error instanceof ApiError && auth.error.status === 403));

  if (showBye) {
    return <ByePage onGiveUp={() => setForceWelcome(true)} />;
  }

  return <WelcomePage authError={queryParams.error} />;
}
