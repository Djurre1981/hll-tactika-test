import { QueryClientProvider } from "./providers/query-client.jsx";
import { AppRouter } from "./router.jsx";
import { AuthGate } from "../features/auth/AuthGate.jsx";
import { HelpWikiProvider } from "../features/help/HelpWikiContext.jsx";
import { ErrorBoundary } from "../shared/ErrorBoundary.jsx";

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider>
        <AuthGate>
          <HelpWikiProvider>
            <AppRouter />
          </HelpWikiProvider>
        </AuthGate>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
