import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function useLineupQuery(lineupId) {
  return useQuery({
    queryKey: queryKeys.lineups.byId(lineupId),
    enabled: Boolean(lineupId),
    queryFn: async () => {
      const data = await apiClient(`/lineups/${lineupId}`);
      return {
        lineup: data.lineup,
        fairnessStats: data.fairnessStats || {},
      };
    },
  });
}

export function useLineupMutation(lineupId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const data = await apiClient(`/lineups/${lineupId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      return {
        lineup: data.lineup,
        fairnessStats: data.fairnessStats,
      };
    },
    onSuccess: (data) => {
      const lineup = data?.lineup;
      queryClient.setQueryData(queryKeys.lineups.byId(lineupId), (prev) => ({
        lineup,
        fairnessStats:
          data?.fairnessStats !== undefined
            ? data.fairnessStats
            : prev?.fairnessStats || {},
      }));
      if (lineup?.eventId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.events.byId(lineup.eventId) });
      }
    },
  });
}
