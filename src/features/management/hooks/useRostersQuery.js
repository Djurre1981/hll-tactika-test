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
    mutationFn: () =>
      apiClient(`/rosters/${rosterId}/seed-from-helo`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
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
