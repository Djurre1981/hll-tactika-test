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

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function useExportPinsMutation() {
  return useMutation({
    mutationFn: async () => {
      const data = await apiClient("/admin/pins-full");
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
        `pins-d1-backup-${date}.json`,
      );
      return data;
    },
  });
}

export function useExportD1SqlMutation() {
  return useMutation({
    mutationFn: async () => {
      const sql = await apiClient("/admin/backup-d1", {
        headers: { Accept: "application/sql, text/plain, */*" },
      });
      if (typeof sql !== "string" || !sql.trim()) {
        throw new Error("Empty D1 backup");
      }
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(new Blob([sql], { type: "application/sql;charset=utf-8" }), `tactika-d1-backup-${date}.sql`);
      return { bytes: sql.length };
    },
  });
}

export function useExportKvMutation() {
  return useMutation({
    mutationFn: async () => {
      const data = await apiClient("/admin/backup-kv");
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
        `tactika-kv-backup-${date}.json`,
      );
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
