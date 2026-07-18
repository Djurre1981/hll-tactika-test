import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function usePresenceMembersQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.presence.members,
    queryFn: () => apiClient("/presence/members"),
    enabled,
    staleTime: 60_000,
  });
}
