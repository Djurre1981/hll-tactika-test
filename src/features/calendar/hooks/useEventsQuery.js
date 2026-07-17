import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export const EVENT_TYPES = ["scrim", "comp", "practice", "other"];

export function monthBounds(year, month) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

function eventsPath(params) {
  const search = new URLSearchParams(params);
  return `/events?${search.toString()}`;
}

function invalidateEvents(queryClient) {
  queryClient.invalidateQueries({ queryKey: ["events"] });
}

export function useEventsByMonthQuery(year, month) {
  return useQuery({
    queryKey: queryKeys.events.byMonth(year, month),
    queryFn: () => apiClient(eventsPath({ year: String(year), month: String(month) })),
  });
}

export function useUpcomingEventsQuery(limit = 3) {
  const now = new Date();
  const from = now.toISOString();
  const toDate = new Date(now);
  toDate.setUTCDate(toDate.getUTCDate() + 45);
  const to = toDate.toISOString();

  return useQuery({
    queryKey: queryKeys.events.upcoming(from.slice(0, 10), to.slice(0, 10)),
    queryFn: () => apiClient(eventsPath({ from, to })),
    select: (data) => ({ events: (data.events || []).slice(0, limit) }),
  });
}

export function useCreateEventMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (event) =>
      apiClient("/events", {
        method: "POST",
        body: JSON.stringify(event),
      }),
    onSuccess: () => invalidateEvents(queryClient),
  });
}

export function useUpdateEventMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, event }) =>
      apiClient(`/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify(event),
      }),
    onSuccess: () => invalidateEvents(queryClient),
  });
}

export function useDeleteEventMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => apiClient(`/events/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateEvents(queryClient),
  });
}
