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

export function useExportPinsMutation() {
  return useMutation({
    mutationFn: async () => {
      const data = await apiClient("/admin/pins-full");
      const date = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pins-d1-backup-${date}.json`;
      link.click();
      URL.revokeObjectURL(url);
      return data;
    },
  });
}

export function useTestDiscordAlertMutation() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/alert-test", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(
          data.error || `Discord probe failed (${data.discordStatus ?? response.status})`,
        );
      }
      return data;
    },
  });
}
