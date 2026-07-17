import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function useWhiteboardQuery(boardId) {
  return useQuery({
    queryKey: queryKeys.whiteboards.byId(boardId),
    queryFn: () => apiClient(`/whiteboards/${boardId}`),
    enabled: Boolean(boardId),
    select: (data) => data.whiteboard,
  });
}
