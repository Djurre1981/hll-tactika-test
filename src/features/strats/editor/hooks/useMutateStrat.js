import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { apiClient } from "../../../../lib/api-client.js";
import { queryKeys } from "../../../../lib/query-keys.js";

/** Serialize strat PUTs so title/slides patches cannot race and clobber each other. */
export function useMutateStrat(stratId) {
  const queryClient = useQueryClient();
  const chainRef = useRef(Promise.resolve());

  return useMutation({
    mutationFn: (stratPatch) => {
      const run = () =>
        apiClient(`/strats/${stratId}`, {
          method: "PUT",
          body: JSON.stringify({ strat: stratPatch }),
        });
      const next = chainRef.current.then(run, run);
      chainRef.current = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
    onMutate: async (stratPatch) => {
      if (!stratPatch?.title) return;
      await queryClient.cancelQueries({ queryKey: queryKeys.strats.meta });
      const prevMeta = queryClient.getQueryData(queryKeys.strats.meta);
      queryClient.setQueryData(queryKeys.strats.meta, (old) => {
        if (!old) return old;
        // meta query may be `{ strats }` or a bare array depending on caller
        if (Array.isArray(old)) {
          return old.map((s) => (s.id === stratId ? { ...s, title: stratPatch.title } : s));
        }
        if (Array.isArray(old.strats)) {
          return {
            ...old,
            strats: old.strats.map((s) =>
              s.id === stratId ? { ...s, title: stratPatch.title } : s,
            ),
          };
        }
        return old;
      });
      const prevById = queryClient.getQueryData(queryKeys.strats.byId(stratId));
      if (prevById?.strat || prevById?.title != null || prevById?.id) {
        queryClient.setQueryData(queryKeys.strats.byId(stratId), (old) => {
          if (!old) return old;
          if (old.strat) return { ...old, strat: { ...old.strat, title: stratPatch.title } };
          return { ...old, title: stratPatch.title };
        });
      }
      return { prevMeta, prevById };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prevMeta !== undefined) {
        queryClient.setQueryData(queryKeys.strats.meta, ctx.prevMeta);
      }
      if (ctx?.prevById !== undefined) {
        queryClient.setQueryData(queryKeys.strats.byId(stratId), ctx.prevById);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.strats.byId(stratId), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.strats.meta });
      queryClient.invalidateQueries({ queryKey: queryKeys.strats.all });
    },
  });
}
