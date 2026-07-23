import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthGate.jsx";
import { apiClient } from "../../lib/api-client.js";
import { queryKeys } from "../../lib/query-keys.js";
import { canEditEvents } from "../calendar/calendar-utils.js";
import { useLinkedEventLock } from "../events/hooks/useLinkedEventLock.js";
import { LinkedEventLockBanner } from "../events/LinkedEventLockBanner.jsx";
import { ToolLockControl } from "../events/ToolLockControl.jsx";
import { Spinner } from "../../shared/Spinner.jsx";
import { canManageToolLock, isToolLocked } from "../../lib/tool-lock.js";
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
    eventId: inner.eventId ?? null,
    routes: Array.isArray(inner.routes) ? inner.routes : [],
    obstacles: Array.isArray(inner.obstacles) ? inner.obstacles : [],
    obstacleVectorBuildId: inner.obstacleVectorBuildId ?? null,
    createdBy: raw.createdBy,
    locked: Boolean(raw.locked),
    lockedBy: raw.lockedBy || null,
  };
}

export function RouteplannerPage({ planId, backTo = "/home" }) {
  const user = useAuth();
  const queryClient = useQueryClient();
  const saveTimer = useRef(null);
  const [dirty, setDirty] = useState(false);
  const latestPayload = useRef(null);
  const roleCanEdit = canEditEvents(user?.role);

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

  const { eventLocked, linkedEvent, canUnlockLinkedEvent } = useLinkedEventLock({
    kind: "routePlan",
    toolId: planId,
    planEventId: query.data?.eventId,
    enabled: Boolean(query.data),
  });
  const canManageToolLockState = canManageToolLock(
    user?.role,
    query.data?.createdBy,
    user?.steamId
  );
  const toolLocked = isToolLocked(query.data);
  const canEdit = roleCanEdit && !eventLocked && !toolLocked;

  const lockMutation = useMutation({
    mutationFn: (lock) =>
      apiClient(`/route-plans/${planId}`, {
        method: "PUT",
        body: JSON.stringify(lock ? { lock: true } : { unlock: true }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.routePlans.byId(planId), normalizePlan(data.plan));
    },
  });

  const handleSave = useCallback(
    (payload) => {
      if (!canEdit) return;
      latestPayload.current = {
        title:
          typeof payload.title === "string" && payload.title.trim()
            ? payload.title.trim()
            : query.data?.title || "Untitled route plan",
        plan: {
          mapId: payload.mapId,
          factionId: payload.factionId,
          hqIndex: payload.hqIndex,
          eventId: payload.eventId ?? query.data?.eventId ?? null,
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
    [canEdit, mutation, query.data?.title, query.data?.eventId]
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
    <div className="relative h-full w-full">
      {linkedEvent ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[40] p-3">
          <div className="pointer-events-auto mx-auto max-w-xl">
            <LinkedEventLockBanner
              linkedEvent={linkedEvent}
              canUnlockLinkedEvent={canUnlockLinkedEvent}
            />
          </div>
        </div>
      ) : null}
      <RouteplannerEditor
        plan={query.data}
        onSave={handleSave}
        saving={mutation.isPending}
        dirty={dirty}
        canEdit={canEdit}
        canManageToolLock={canManageToolLockState && !eventLocked}
        toolLocked={toolLocked}
        lockPending={lockMutation.isPending}
        onToggleToolLock={(nextLocked) => lockMutation.mutate(nextLocked)}
        backTo={backTo}
      />
    </div>
  );
}
