import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

function invalidatePrepTasks(queryClient, eventId) {
  if (eventId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.prepTasks.byEvent(eventId) });
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.prepTasks.mineRoot });
  queryClient.invalidateQueries({ queryKey: queryKeys.prepTasks.openRoot });
}

export function usePrepTasksQuery(eventId, enabled = true) {
  return useQuery({
    queryKey: queryKeys.prepTasks.byEvent(eventId),
    queryFn: () => apiClient(`/events/${eventId}/prep-tasks`).then((d) => d.tasks || []),
    enabled: Boolean(eventId) && enabled,
  });
}

export function useMyPrepTasksQuery({ from, to, enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.prepTasks.mine(from, to),
    queryFn: () => {
      const search = new URLSearchParams({ from, to });
      return apiClient(`/prep-tasks/mine?${search.toString()}`).then((d) => d.tasks || []);
    },
    enabled: Boolean(from && to) && enabled,
    staleTime: 30_000,
  });
}

/** Staff: all incomplete prep tasks in a date window. */
export function useOpenPrepTasksQuery({ from, to, enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.prepTasks.open(from, to),
    queryFn: () => {
      const search = new URLSearchParams({ from, to });
      return apiClient(`/prep-tasks/open?${search.toString()}`).then((d) => d.tasks || []);
    },
    enabled: Boolean(from && to) && enabled,
    staleTime: 30_000,
  });
}

export function useCreatePrepTaskMutation(eventId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) =>
      apiClient(`/events/${eventId}/prep-tasks`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSettled: () => invalidatePrepTasks(queryClient, eventId),
  });
}

export function useUpdatePrepTaskMutation(eventId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, ...payload }) =>
      apiClient(`/events/${eventId}/prep-tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSettled: () => invalidatePrepTasks(queryClient, eventId),
  });
}

export function useDeletePrepTaskMutation(eventId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId) =>
      apiClient(`/events/${eventId}/prep-tasks/${taskId}`, {
        method: "DELETE",
      }),
    onSettled: () => invalidatePrepTasks(queryClient, eventId),
  });
}
