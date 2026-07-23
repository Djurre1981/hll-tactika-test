import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEventComponentsMutation } from "../../calendar/hooks/useEventsQuery.js";
import { queryKeys } from "../../../lib/query-keys.js";
import { syncRoutePlanEventLink } from "../event-component-sync.js";

export function useEventComponentActions(eventId) {
  const queryClient = useQueryClient();
  const mutation = useEventComponentsMutation();
  const [error, setError] = useState("");

  const attach = useCallback(async (kind, id) => {
    if (!eventId || !id) return;
    setError("");

    const apiType =
      kind === "strat"
        ? "strat"
        : kind === "routePlan"
          ? "routePlan"
          : kind === "whiteboard"
            ? "whiteboard"
            : kind === "roster"
              ? "roster"
              : null;

    if (!apiType) return;

    try {
      await mutation.mutateAsync({
        eventId,
        action: "attach",
        type: apiType,
        id,
      });

      if (kind === "routePlan") {
        await syncRoutePlanEventLink(id, eventId);
        queryClient.invalidateQueries({ queryKey: queryKeys.routePlans.byId(id) });
      }
    } catch (attachError) {
      setError(attachError?.message || "Could not attach.");
      throw attachError;
    }
  }, [eventId, mutation, queryClient]);

  const detach = useCallback(async (kind, id) => {
    if (!eventId || !id) return;
    setError("");

    const apiType =
      kind === "strat"
        ? "strat"
        : kind === "routePlan"
          ? "routePlan"
          : kind === "whiteboard"
            ? "whiteboard"
            : kind === "roster"
              ? "roster"
              : null;

    if (!apiType) return;

    try {
      await mutation.mutateAsync({
        eventId,
        action: "detach",
        type: apiType,
        id,
      });

      if (kind === "routePlan") {
        await syncRoutePlanEventLink(id, null);
        queryClient.invalidateQueries({ queryKey: queryKeys.routePlans.byId(id) });
      }
    } catch (detachError) {
      setError(detachError?.message || "Could not detach.");
      throw detachError;
    }
  }, [eventId, mutation, queryClient]);

  return useMemo(
    () => ({
      attach,
      detach,
      pending: mutation.isPending,
      error,
      clearError: () => setError(""),
    }),
    [attach, detach, mutation.isPending, error]
  );
}
