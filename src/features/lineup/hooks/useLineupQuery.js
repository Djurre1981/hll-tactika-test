import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function useLineupQuery(lineupId) {
  return useQuery({
    queryKey: queryKeys.lineups.byId(lineupId),
    enabled: Boolean(lineupId),
    queryFn: async () => {
      const data = await apiClient(`/lineups/${lineupId}`);
      return data.lineup;
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
      return data.lineup;
    },
    onSuccess: (lineup) => {
      queryClient.setQueryData(queryKeys.lineups.byId(lineupId), lineup);
      if (lineup?.eventId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.events.byId(lineup.eventId) });
      }
    },
  });
}
