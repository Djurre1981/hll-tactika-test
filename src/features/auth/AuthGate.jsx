import { createContext, useContext, useRef, useState } from "react";
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

function resolveGuestView({ forceWelcome, queryParams, auth }) {
  if (forceWelcome) return "welcome";

  const isHardError =
    auth.error &&
    !(auth.error instanceof ApiError && (auth.error.status === 401 || auth.error.status === 403));

  if (isHardError) return "welcome-error";

  if (queryParams.view === "bye" || (auth.error instanceof ApiError && auth.error.status === 403)) {
    return "bye";
  }

  return "welcome";
}

export function AuthGate({ children }) {
  const auth = useAuthQuery();
  const queryParams = useAuthQueryParams();
  const [forceWelcome, setForceWelcome] = useState(false);
  const guestViewRef = useRef(null);
  const welcomeErrorRef = useRef(null);

  if (!queryParams.ready || (auth.isPending && !auth.data && !auth.error)) {
    return <AuthLoading />;
  }

  if (auth.data?.authenticated) {
    guestViewRef.current = null;
    welcomeErrorRef.current = null;
    return <AuthContext.Provider value={auth.data}>{children}</AuthContext.Provider>;
  }

  const nextView = resolveGuestView({ forceWelcome, queryParams, auth });

  // Keep guest screens mounted across auth refetches; allow bye → welcome via Give up.
  if (forceWelcome) {
    guestViewRef.current = "welcome";
  } else if (!guestViewRef.current || nextView === "bye" || guestViewRef.current === "bye") {
    guestViewRef.current = nextView;
  }

  if (guestViewRef.current === "bye") {
    return <ByePage onGiveUp={() => setForceWelcome(true)} />;
  }

  if (guestViewRef.current === "welcome-error") {
    if (!welcomeErrorRef.current) {
      welcomeErrorRef.current = {
        message: auth.error?.message || "Unable to load your session.",
        showLogin: false,
      };
    }
    return <WelcomePage authError={welcomeErrorRef.current} />;
  }

  return <WelcomePage authError={queryParams.error} />;
}
