import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function useAuthQuery() {
  return useQuery({
    queryKey: queryKeys.users.me,
    queryFn: () => apiClient("/auth/me"),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      window.location.assign("/");
    },
  });
}
