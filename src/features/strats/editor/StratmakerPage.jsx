import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";
import { Spinner } from "../../../shared/Spinner.jsx";
import { StratEditor } from "./StratEditor.jsx";
import { getDefaultMapId } from "./mapIds.js";

/**
 * Full-page Stratmaker entry: creates a new D1 strat then opens the editor shell.
 */
export function StratmakerPage() {
  const queryClient = useQueryClient();
  const [stratId, setStratId] = useState(null);
  const [error, setError] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const mapId = getDefaultMapId();
    const slideId = `slide-${crypto.randomUUID()}`;

    apiClient("/strats", {
      method: "POST",
      body: JSON.stringify({
        strat: {
          title: "Untitled Strat",
          slides: [
            {
              id: slideId,
              name: "Open",
              order: 0,
              mapId,
              objects: [],
            },
          ],
          match: { mapId },
        },
      }),
    })
      .then((data) => {
        const id = data?.strat?.id;
        if (!id) throw new Error("Create failed");
        queryClient.setQueryData(queryKeys.strats.byId(id), data);
        queryClient.invalidateQueries({ queryKey: queryKeys.strats.meta });
        queryClient.invalidateQueries({ queryKey: queryKeys.strats.all });
        setStratId(id);
      })
      .catch((err) => {
        setError(err?.message || "Could not create strat");
      });
  }, [queryClient]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0b0f14] p-6">
        <p className="text-white/60">{error}</p>
        <Link to="/home" className="text-amber-300/90 hover:underline">
          Back to hub
        </Link>
      </div>
    );
  }

  if (!stratId) {
    return (
      <div className="flex h-full items-center justify-center gap-2 bg-[#0b0f14] text-white/50">
        <Spinner /> Creating strat…
      </div>
    );
  }

  return <StratEditor stratId={stratId} backTo="/home" />;
}
