import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

const HISTORY_MONTHS = 24;

export function useMatchHistoryQuery() {
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setUTCMonth(from.getUTCMonth() - HISTORY_MONTHS);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      keyFrom: from.toISOString().slice(0, 10),
      keyTo: to.toISOString().slice(0, 10),
    };
  }, []);

  return useQuery({
    queryKey: queryKeys.events.history(range.keyFrom, range.keyTo),
    queryFn: () => {
      const search = new URLSearchParams({ from: range.from, to: range.to });
      return apiClient(`/events?${search.toString()}`).then((data) => data.events || []);
    },
    staleTime: 60_000,
  });
}
