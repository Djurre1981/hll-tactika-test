import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../../lib/api-client.js";
import { queryKeys } from "../../../../lib/query-keys.js";

export function useFoldersListQuery() {
  return useQuery({
    queryKey: queryKeys.folders.all,
    queryFn: () => apiClient("/folders"),
  });
}

export function useStratsMetaQuery() {
  return useQuery({
    queryKey: queryKeys.strats.meta,
    queryFn: () => apiClient("/strats?meta=1"),
  });
}

export function useMoveStratMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, folderId }) =>
      apiClient(`/strats/${id}`, {
        method: "PUT",
        body: JSON.stringify({ strat: { folderId } }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.strats.meta });
      queryClient.invalidateQueries({ queryKey: queryKeys.strats.all });
    },
  });
}

export function useDeleteStratMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => apiClient(`/strats/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.strats.meta });
      queryClient.invalidateQueries({ queryKey: queryKeys.strats.all });
    },
  });
}
