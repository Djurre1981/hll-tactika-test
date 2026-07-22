import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client.js";
import { queryKeys } from "../../lib/query-keys.js";
import { Spinner } from "../../shared/Spinner.jsx";

export function RouteplannerEntryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    apiClient("/route-plans", {
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
    })
      .then((data) => {
        const id = data?.plan?.id;
        if (!id) throw new Error("Create failed");
        queryClient.setQueryData(queryKeys.routePlans.byId(id), data.plan);
        queryClient.invalidateQueries({ queryKey: queryKeys.routePlans.all });
        navigate(`/routeplanner/${id}`, { replace: true });
      })
      .catch((err) => {
        setError(err?.message || "Could not create route plan");
      });
  }, [navigate, queryClient]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0f0f0f] p-6">
        <p className="text-white/60">{error}</p>
        <Link to="/home" className="text-amber-300/90 hover:underline">
          Back to hub
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center gap-2 bg-[#0f0f0f] text-white/50">
      <Spinner /> Creating route plan…
    </div>
  );
}
