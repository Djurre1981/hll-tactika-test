import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function useEventRsvpsQuery(eventId, enabled = true) {
  return useQuery({
    queryKey: queryKeys.rsvps.byEvent(eventId),
    queryFn: () => apiClient(`/events/${eventId}/rsvps`),
    enabled: Boolean(eventId) && enabled,
    staleTime: 15_000,
  });
}

export function useUpsertRsvpMutation(eventId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) =>
      apiClient(`/events/${eventId}/rsvps`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rsvps.byEvent(eventId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.rsvps.root });
    },
  });
}
