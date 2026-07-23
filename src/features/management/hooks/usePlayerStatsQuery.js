import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function useEventPlayerStatsQuery(eventId, enabled = true) {
  return useQuery({
    queryKey: queryKeys.playerStats.byEvent(eventId),
    queryFn: () =>
      apiClient(`/player-stats?eventId=${encodeURIComponent(eventId)}`).then((d) => d.stats || []),
    enabled: Boolean(eventId) && enabled,
  });
}

export function usePlayerStatsAggregatesQuery(steamIds = [], enabled = true) {
  const ids = [...new Set((steamIds || []).map((id) => String(id || "").trim()).filter(Boolean))].sort();
  const key = ids.join(",");

  return useQuery({
    queryKey: queryKeys.playerStats.aggregates(key || "none"),
    queryFn: () =>
      apiClient(`/player-stats?steamIds=${encodeURIComponent(key)}`).then((d) => d.aggregates || {}),
    enabled: ids.length > 0 && enabled,
    staleTime: 60_000,
  });
}
