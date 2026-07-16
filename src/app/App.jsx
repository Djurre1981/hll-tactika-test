import { QueryClientProvider } from "./providers/query-client.jsx";
import { AppRouter } from "./router.jsx";
import { ErrorBoundary } from "../shared/ErrorBoundary.jsx";

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider>
        <AppRouter />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
