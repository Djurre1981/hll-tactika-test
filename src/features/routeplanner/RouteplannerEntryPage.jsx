import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client.js";
import { queryKeys } from "../../lib/query-keys.js";
import { Spinner } from "../../shared/Spinner.jsx";
import { glassSurface } from "../../shared/glassUi.js";

/**
 * Routeplanner entry: choose New plan or open a recent one (no auto-create on visit).
 */
export function RouteplannerEntryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  const recentQuery = useQuery({
    queryKey: queryKeys.routePlans.all,
    queryFn: () => apiClient("/route-plans").then((d) => d.plans || []),
  });

  const recent = (recentQuery.data || []).slice(0, 8);

  const createPlan = async () => {
    if (creating) return;
    setError(null);
    setCreating(true);

    try {
      const data = await apiClient("/route-plans", {
        method: "POST",
        body: JSON.stringify({
          plan: {
            title: "Untitled route plan",
            plan: {
              mapId: "Carentan",
              factionId: "us",
              hqIndex: 0,
              routes: [],
            },
          },
        }),
      });
      const id = data?.plan?.id;
      if (!id) throw new Error("Create failed");
      queryClient.setQueryData(queryKeys.routePlans.byId(id), data.plan);
      queryClient.invalidateQueries({ queryKey: queryKeys.routePlans.all });
      navigate(`/routeplanner/${id}`, { replace: true });
    } catch (err) {
      setError(err?.message || "Could not create route plan");
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-[#0f0f0f] p-6">
      <div className="text-center">
        <h1 className="m-0 text-2xl font-light tracking-[0.04em] text-white/90">Routeplanner</h1>
        <p className="mt-2 text-sm font-light text-white/45">
          Create a new plan or open a recent one.
        </p>
      </div>

      <button
        type="button"
        disabled={creating}
        onClick={createPlan}
        className={`${glassSurface} flex min-h-[120px] w-full max-w-xl flex-col items-start justify-center gap-2 p-8 text-left transition hover:border-white/25 hover:bg-[rgba(60,60,60,0.9)] disabled:cursor-wait disabled:opacity-60`}
      >
        <span className="text-xl font-light tracking-[0.06em] text-white/95">New route plan</span>
        <span className="text-sm font-light leading-relaxed text-white/50">
          Timed transport truck routes on the tacmap.
        </span>
        {creating ? (
          <span className="mt-2 inline-flex items-center gap-2 text-xs text-white/40">
            <Spinner /> Creating…
          </span>
        ) : null}
      </button>

      <div className="w-full max-w-xl">
        <p className="m-0 mb-3 text-[0.68rem] font-light uppercase tracking-[0.14em] text-white/40">
          Recent
        </p>
        {recentQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-white/40">
            <Spinner /> Loading…
          </div>
        ) : recent.length === 0 ? (
          <p className="m-0 text-sm text-white/40">No route plans yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {recent.map((plan) => (
              <li key={plan.id}>
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => navigate(`/routeplanner/${plan.id}`, { replace: true })}
                  className="flex w-full items-center justify-between rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-50"
                >
                  <span className="truncate text-[0.92rem] text-white/90">
                    {plan.title || "Untitled route plan"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? <p className="text-sm text-red-400/90">{error}</p> : null}

      <Link to="/home" className="text-sm text-amber-300/90 hover:underline">
        Back to hub
      </Link>
    </div>
  );
}
