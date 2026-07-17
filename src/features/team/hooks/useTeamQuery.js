import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function useTeamQuery() {
  return useQuery({
    queryKey: queryKeys.team.roster,
    queryFn: () => apiClient("/admin/users"),
  });
}

export function useAddTeamMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (steamId) =>
      apiClient("/admin/users", {
        method: "POST",
        body: JSON.stringify({ steamId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.team.roster }),
  });
}

export function useUpdateTeamMemberRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ steamId, role }) =>
      apiClient(`/admin/users/${steamId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.team.roster }),
  });
}

export function useRemoveTeamMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (steamId) => apiClient(`/admin/users/${steamId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.team.roster }),
  });
}
