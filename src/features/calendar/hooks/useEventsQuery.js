import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export const EVENT_TYPES = ["scrim", "comp", "practice", "other"];

function eventsPath(params) {
  const search = new URLSearchParams(params);
  return `/events?${search.toString()}`;
}

function invalidateEvents(queryClient) {
  queryClient.invalidateQueries({ queryKey: ["events"] });
}

function patchEventsCaches(queryClient, updater) {
  const entries = queryClient.getQueriesData({ queryKey: ["events"] });
  for (const [key, data] of entries) {
    if (!data?.events) continue;
    queryClient.setQueryData(key, { ...data, events: updater(data.events) });
  }
}

export function useEventsByMonthQuery(year, month) {
  return useQuery({
    queryKey: queryKeys.events.byMonth(year, month),
    queryFn: () => apiClient(eventsPath({ year: String(year), month: String(month) })),
  });
}

export function useEventsRangeQuery({ from, to, enabled = true } = {}) {
  const range = useMemo(() => {
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date(start);
    if (!to) {
      end.setUTCDate(end.getUTCDate() + 120);
    }
    return {
      from: start.toISOString(),
      to: end.toISOString(),
      keyFrom: start.toISOString().slice(0, 10),
      keyTo: end.toISOString().slice(0, 10),
    };
  }, [from, to]);

  return useQuery({
    queryKey: queryKeys.events.upcoming(range.keyFrom, range.keyTo),
    queryFn: () => apiClient(eventsPath({ from: range.from, to: range.to })),
    enabled,
    staleTime: 60_000,
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
    onMutate: async (event) => {
      await queryClient.cancelQueries({ queryKey: ["events"] });
      const previous = queryClient.getQueriesData({ queryKey: ["events"] });
      const optimistic = {
        ...event,
        id: `temp-${crypto.randomUUID()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      patchEventsCaches(queryClient, (events) =>
        [...events, optimistic].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => invalidateEvents(queryClient),
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
    onMutate: async ({ id, event }) => {
      await queryClient.cancelQueries({ queryKey: ["events"] });
      const previous = queryClient.getQueriesData({ queryKey: ["events"] });
      patchEventsCaches(queryClient, (events) =>
        events
          .map((item) => (item.id === id ? { ...item, ...event, updatedAt: new Date().toISOString() } : item))
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => invalidateEvents(queryClient),
  });
}

export function useDeleteEventMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => apiClient(`/events/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["events"] });
      const previous = queryClient.getQueriesData({ queryKey: ["events"] });
      patchEventsCaches(queryClient, (events) => events.filter((event) => event.id !== id));
      return { previous };
    },
    onError: (_error, _vars, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => invalidateEvents(queryClient),
  });
}
