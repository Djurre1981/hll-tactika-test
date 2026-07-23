import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import { apiClient } from "../../../lib/api-client.js";
import { GlassSelect } from "../../../shared/GlassSelect.jsx";
import { queryKeys } from "../../../lib/query-keys.js";
import {
  filterRoutePlansForSlide,
  routeFactionLabel,
  stratFactionToRouteFaction,
} from "../../routeplanner/strat-route-link.js";
import { cx, fieldLabel, glassBtn } from "./editorUi.js";

function normalizeRoutePlanRecord(raw) {
  if (!raw) return null;
  const inner = raw.plan && typeof raw.plan === "object" ? raw.plan : {};
  return {
    id: raw.id,
    title: raw.title || "Untitled route plan",
    mapId: raw.mapId ?? inner.mapId ?? null,
    factionId: raw.factionId ?? inner.factionId ?? null,
    plan: inner,
  };
}

export function SlideRoutePlanPicker({
  slide,
  strat,
  canEdit,
  onChangeRoutePlan,
}) {
  const [copied, setCopied] = useState(false);
  const routePlanId = slide?.routePlanId || "";

  const listQuery = useQuery({
    queryKey: queryKeys.routePlans.all,
    queryFn: () => apiClient("/route-plans").then((d) => d.plans || []),
    staleTime: 60_000,
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.routePlans.byId(routePlanId),
    queryFn: () => apiClient(`/route-plans/${routePlanId}`).then((d) => normalizeRoutePlanRecord(d.plan)),
    enabled: Boolean(routePlanId),
  });

  const stratFaction = strat?.match?.faction || "";
  const expectedRouteFaction = stratFactionToRouteFaction(stratFaction);

  const compatiblePlans = useMemo(
    () => filterRoutePlansForSlide(listQuery.data, slide?.mapId, stratFaction),
    [listQuery.data, slide?.mapId, stratFaction]
  );

  const copyLink = useCallback(async () => {
    if (!routePlanId) return;
    const path = `/routeplanner/${routePlanId}`;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [routePlanId]);

  const brokenLink = routePlanId && detailQuery.isError;

  return (
    <div className="flex flex-col gap-2">
      <label className={fieldLabel}>
        Route plan
        <GlassSelect
          className="mt-1"
          disabled={!canEdit || listQuery.isLoading}
          value={routePlanId}
          onChange={(value) => onChangeRoutePlan?.(slide.id, value || null)}
          placeholder="None"
          options={compatiblePlans.map((p) => ({
            value: p.id,
            label: `${p.title} (${routeFactionLabel(p.factionId)})`,
          }))}
        />
      </label>

      {!expectedRouteFaction && (
        <p className="m-0 text-[0.66rem] leading-snug text-amber-200/70">
          Set match faction in strat details for strict US/GER filtering.
        </p>
      )}

      {compatiblePlans.length === 0 && !listQuery.isLoading && (
        <p className="m-0 text-[0.66rem] text-white/40">
          No route plans for {slide?.mapId}
          {expectedRouteFaction ? ` (${routeFactionLabel(expectedRouteFaction)})` : ""}.
        </p>
      )}

      {brokenLink && (
        <p className="m-0 text-[0.66rem] text-red-300/90">
          Linked route plan missing or inaccessible.
          {canEdit && (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => onChangeRoutePlan?.(slide.id, null)}
            >
              Clear link
            </button>
          )}
        </p>
      )}

      {routePlanId && !brokenLink && (
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/routeplanner/${routePlanId}`}
            className={cx(glassBtn, "text-[0.72rem] no-underline")}
          >
            Open in Routeplanner
          </Link>
          <button type="button" className={cx(glassBtn, "text-[0.72rem]")} onClick={copyLink}>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}
