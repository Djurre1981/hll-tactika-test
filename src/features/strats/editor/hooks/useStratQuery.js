import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../../lib/api-client.js";
import { queryKeys } from "../../../../lib/query-keys.js";

export function useStratQuery(stratId) {
  return useQuery({
    queryKey: queryKeys.strats.byId(stratId),
    queryFn: () => apiClient(`/strats/${stratId}`),
    enabled: Boolean(stratId),
    select: (data) => data.strat,
  });
}
