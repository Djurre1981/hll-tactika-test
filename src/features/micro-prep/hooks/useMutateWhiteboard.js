import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function useMutateWhiteboard(boardId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch) =>
      apiClient(`/whiteboards/${boardId}`, {
        method: "PUT",
        body: JSON.stringify({ whiteboard: patch }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.whiteboards.byId(boardId), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.whiteboards.all });
    },
  });
}
