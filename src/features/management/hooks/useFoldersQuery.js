import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function useFoldersQuery() {
  return useQuery({
    queryKey: queryKeys.folders.all,
    queryFn: () => apiClient("/folders"),
  });
}

export function useCreateFolderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (folder) =>
      apiClient("/folders", {
        method: "POST",
        body: JSON.stringify(folder),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.folders.all }),
  });
}

export function useUpdateFolderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...updates }) =>
      apiClient(`/folders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.strats.meta });
    },
  });
}

export function useDeleteFolderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => apiClient(`/folders/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.strats.meta });
    },
  });
}
