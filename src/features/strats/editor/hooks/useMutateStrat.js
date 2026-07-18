import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../../lib/api-client.js";
import { queryKeys } from "../../../../lib/query-keys.js";

export function useMutateStrat(stratId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (stratPatch) =>
      apiClient(`/strats/${stratId}`, {
        method: "PUT",
        body: JSON.stringify({ strat: stratPatch }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.strats.byId(stratId), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.strats.meta });
      queryClient.invalidateQueries({ queryKey: queryKeys.strats.all });
    },
  });
}
