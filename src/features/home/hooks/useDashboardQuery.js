import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function useStratsCountQuery() {
  return useQuery({
    queryKey: queryKeys.strats.all,
    queryFn: () => apiClient("/strats"),
    select: (data) => (data.strats || []).length,
  });
}

function useUpcomingEventsQuery(limit = 3) {
  const range = useMemo(() => {
    const now = new Date();
    const toDate = new Date(now);
    toDate.setUTCDate(toDate.getUTCDate() + 45);
    return {
      from: now.toISOString(),
      to: toDate.toISOString(),
      keyFrom: now.toISOString().slice(0, 10),
      keyTo: toDate.toISOString().slice(0, 10),
    };
  }, []);

  return useQuery({
    queryKey: queryKeys.events.upcoming(range.keyFrom, range.keyTo),
    queryFn: () => {
      const search = new URLSearchParams({ from: range.from, to: range.to });
      return apiClient(`/events?${search.toString()}`);
    },
    select: (data) => ({ events: (data.events || []).slice(0, limit) }),
  });
}

export function useDashboardQuery() {
  const strats = useStratsCountQuery();
  const upcoming = useUpcomingEventsQuery(3);

  return { strats, upcoming };
}
