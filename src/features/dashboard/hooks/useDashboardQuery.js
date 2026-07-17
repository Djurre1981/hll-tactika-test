import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";
import { useUpcomingEventsQuery } from "../../calendar/hooks/useEventsQuery.js";

export function useStratsCountQuery() {
  return useQuery({
    queryKey: queryKeys.strats.all,
    queryFn: () => apiClient("/strats"),
    select: (data) => (data.strats || []).length,
  });
}

export function useDashboardQuery() {
  const strats = useStratsCountQuery();
  const upcoming = useUpcomingEventsQuery(3);

  return { strats, upcoming };
}
