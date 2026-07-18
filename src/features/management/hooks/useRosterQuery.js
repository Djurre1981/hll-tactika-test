import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function useRosterQuery() {
  return useQuery({
    queryKey: queryKeys.roster.all,
    queryFn: () => apiClient("/roster"),
  });
}

export function useAddRosterMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (member) =>
      apiClient("/roster", {
        method: "POST",
        body: JSON.stringify(member),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roster.all }),
  });
}

export function useUpdateRosterMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...updates }) =>
      apiClient(`/roster/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roster.all }),
  });
}

export function useRemoveRosterMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => apiClient(`/roster/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roster.all }),
  });
}
