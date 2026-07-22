import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client.js";
import { queryKeys } from "../../lib/query-keys.js";
import { Spinner } from "../../shared/Spinner.jsx";
import { RouteplannerEditor } from "./RouteplannerEditor.jsx";

function normalizePlan(raw) {
  if (!raw) return null;
  const inner = raw.plan && typeof raw.plan === "object" ? raw.plan : {};
  return {
    id: raw.id,
    title: raw.title || "Untitled route plan",
    mapId: inner.mapId || "Carentan",
    factionId: inner.factionId || "us",
    hqIndex: inner.hqIndex ?? 0,
    routes: Array.isArray(inner.routes) ? inner.routes : [],
    obstacles: Array.isArray(inner.obstacles) ? inner.obstacles : [],
    obstacleVectorBuildId: inner.obstacleVectorBuildId ?? null,
  };
}

export function RouteplannerPage({ planId, backTo = "/home" }) {
  const queryClient = useQueryClient();
  const saveTimer = useRef(null);
  const [dirty, setDirty] = useState(false);
  const latestPayload = useRef(null);

  const query = useQuery({
    queryKey: queryKeys.routePlans.byId(planId),
    queryFn: () => apiClient(`/route-plans/${planId}`).then((d) => normalizePlan(d.plan)),
  });

  const mutation = useMutation({
    mutationFn: (payload) =>
      apiClient(`/route-plans/${planId}`, {
        method: "PUT",
        body: JSON.stringify({ plan: payload }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.routePlans.byId(planId), normalizePlan(data.plan));
      setDirty(false);
    },
  });

  const handleSave = useCallback(
    (payload) => {
      latestPayload.current = {
        title: query.data?.title || "Untitled route plan",
        plan: {
          mapId: payload.mapId,
          factionId: payload.factionId,
          hqIndex: payload.hqIndex,
          routes: payload.routes,
          obstacles: payload.obstacles,
          obstacleVectorBuildId: payload.obstacleVectorBuildId ?? null,
        },
      };
      setDirty(true);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (latestPayload.current) mutation.mutate(latestPayload.current);
      }, 800);
    },
    [mutation, query.data?.title]
  );

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  if (query.isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 bg-[#0f0f0f] text-white/50">
        <Spinner /> Loading route plan…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0f0f0f] p-6">
        <p className="text-white/50">{query.error?.message || "Route plan not found"}</p>
        <Link to={backTo} className="text-amber-300/90 hover:underline">
          Back to hub
        </Link>
      </div>
    );
  }

  return (
    <RouteplannerEditor
      plan={query.data}
      onSave={handleSave}
      saving={mutation.isPending}
      dirty={dirty}
      backTo={backTo}
    />
  );
}
