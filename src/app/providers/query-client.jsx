import { QueryClient, QueryClientProvider as TanStackProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: true,
    },
  },
});

export function QueryClientProvider({ children }) {
  return <TanStackProvider client={queryClient}>{children}</TanStackProvider>;
}
