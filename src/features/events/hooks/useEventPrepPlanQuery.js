import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

function invalidatePrepQueries(queryClient, eventId) {
  queryClient.invalidateQueries({ queryKey: queryKeys.prepPlan.byEvent(eventId) });
  queryClient.invalidateQueries({ queryKey: ["prep-tasks"] });
}

export function useEventPrepPlanQuery(eventId, enabled = true) {
  return useQuery({
    queryKey: queryKeys.prepPlan.byEvent(eventId),
    queryFn: () => apiClient(`/events/${eventId}/prep-plan`),
    enabled: Boolean(eventId) && enabled,
    staleTime: 15_000,
  });
}

export function useSaveEventPrepPlanMutation(eventId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slots) =>
      apiClient(`/events/${eventId}/prep-plan`, {
        method: "PUT",
        body: JSON.stringify({ slots }),
      }),
    onSuccess: () => invalidatePrepQueries(queryClient, eventId),
  });
}

export function useCompletePrepSlotMutation(eventId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskType, done }) =>
      apiClient(`/events/${eventId}/prep-plan`, {
        method: "PATCH",
        body: JSON.stringify({ taskType, done }),
      }),
    onSuccess: () => invalidatePrepQueries(queryClient, eventId),
  });
}
