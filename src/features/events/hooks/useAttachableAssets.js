import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function useAttachableStratsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.strats.meta,
    queryFn: () => apiClient("/strats?meta=1").then((d) => d.strats || []),
    enabled,
    staleTime: 60_000,
  });
}

export function useAttachableRoutePlansQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.routePlans.all,
    queryFn: () => apiClient("/route-plans").then((d) => d.plans || []),
    enabled,
    staleTime: 60_000,
  });
}

export function useAttachableWhiteboardsQuery(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.whiteboards.all, "meta"],
    queryFn: () => apiClient("/whiteboards?meta=1").then((d) => d.whiteboards || []),
    enabled,
    staleTime: 60_000,
  });
}

export function useAttachableRostersQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.rosters.all,
    queryFn: () => apiClient("/rosters").then((d) => d.rosters || []),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}
