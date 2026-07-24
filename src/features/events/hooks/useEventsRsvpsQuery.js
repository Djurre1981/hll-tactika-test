import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

/**
 * Parallel RSVP fetches for a list of event ids.
 * @param {string[]} eventIds
 */
export function useEventsRsvpsQuery(eventIds = []) {
  const idsKey = [...new Set((eventIds || []).map(String).filter(Boolean))].sort().join(",");
  const ids = useMemo(() => (idsKey ? idsKey.split(",") : []), [idsKey]);

  const queries = useQueries({
    queries: ids.map((eventId) => ({
      queryKey: queryKeys.rsvps.byEvent(eventId),
      queryFn: () => apiClient(`/events/${eventId}/rsvps`),
      staleTime: 15_000,
      enabled: Boolean(eventId),
    })),
  });

  const counts = new Map();
  const seats = new Map();
  const payloads = new Map();
  ids.forEach((id, index) => {
    const data = queries[index]?.data;
    if (!data) return;
    payloads.set(id, data);
    if (data.counts) counts.set(id, data.counts);
    if (data.seats) seats.set(id, data.seats);
  });

  return {
    counts,
    seats,
    payloads,
    isLoading: queries.some((q) => q.isLoading),
    isFetching: queries.some((q) => q.isFetching),
  };
}
