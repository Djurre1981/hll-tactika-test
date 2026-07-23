import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function useRostersQuery() {
  return useQuery({
    queryKey: queryKeys.rosters.all,
    queryFn: () => apiClient("/rosters"),
  });
}

export function useRosterMembersQuery(rosterId) {
  return useQuery({
    queryKey: queryKeys.rosters.members(rosterId),
    queryFn: () => apiClient(`/rosters/${rosterId}/members`),
    enabled: Boolean(rosterId),
  });
}

export function useCreateRosterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roster) =>
      apiClient("/rosters", {
        method: "POST",
        body: JSON.stringify(roster),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.rosters.all }),
  });
}

export function useUpdateRosterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...updates }) =>
      apiClient(`/rosters/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.root });
    },
  });
}

export function useDeleteRosterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rosterId) => apiClient(`/rosters/${rosterId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.root });
    },
  });
}

export function useAddRosterMemberToRosterMutation(rosterId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (member) =>
      apiClient(`/rosters/${rosterId}/members`, {
        method: "POST",
        body: JSON.stringify(member),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.members(rosterId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.roster.all });
    },
  });
}

export function useRemoveMemberFromRosterMutation(rosterId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId) =>
      apiClient(`/rosters/${rosterId}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.members(rosterId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.all });
    },
  });
}

export function useImportRosterCsvMutation(rosterId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (csv) =>
      apiClient(`/rosters/${rosterId}/import`, {
        method: "POST",
        body: JSON.stringify({ csv }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.members(rosterId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.roster.all });
    },
  });
}

export function useDuplicateRosterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rosterId, name, isTemplate }) =>
      apiClient(`/rosters/${rosterId}/duplicate`, {
        method: "POST",
        body: JSON.stringify({ name, isTemplate }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.root });
    },
  });
}

export function useSeedRosterFromHeloMutation(rosterId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      let added = 0;
      let linked = 0;
      let skipped = 0;
      let failed = 0;
      let totalSteamIds = 0;
      let rounds = 0;
      // Chunked seed — Workers time out if we try everyone in one request.
      for (let i = 0; i < 20; i += 1) {
        rounds += 1;
        const data = await apiClient(`/rosters/${rosterId}/seed-from-helo`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        added += Number(data.added) || 0;
        linked += Number(data.linked) || 0;
        skipped = Number(data.skipped) || skipped;
        failed += Number(data.failed) || 0;
        totalSteamIds = Number(data.totalSteamIds) || totalSteamIds;
        if (data.done || !(Number(data.remaining) > 0)) {
          return { ...data, added, linked, skipped, failed, totalSteamIds, rounds };
        }
      }
      return {
        added,
        linked,
        skipped,
        failed,
        totalSteamIds,
        rounds,
        done: false,
        remaining: 1,
        note: "Stopped after max rounds — click Seed again to continue",
      };
    },
    onSuccess: () => {
      if (rosterId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.rosters.members(rosterId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.roster.all });
    },
  });
}

export function useUpdateRosterMemberMutation(rosterId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...updates }) =>
      apiClient(`/roster/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      if (rosterId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.rosters.members(rosterId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.roster.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.root });
    },
  });
}
