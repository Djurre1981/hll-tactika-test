import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client.js";
import { queryKeys } from "../../lib/query-keys.js";
import { Spinner } from "../../shared/Spinner.jsx";

/**
 * Full-page Micro-Prep entry: creates a D1 whiteboard then opens the editor.
 */
export function MicroPrepEntryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    apiClient("/whiteboards", {
      method: "POST",
      body: JSON.stringify({
        whiteboard: {
          title: "Untitled Board",
          scene: { elements: [], appState: { theme: "dark" }, files: {} },
        },
      }),
    })
      .then((data) => {
        const id = data?.whiteboard?.id;
        if (!id) throw new Error("Create failed");
        queryClient.setQueryData(queryKeys.whiteboards.byId(id), data);
        queryClient.invalidateQueries({ queryKey: queryKeys.whiteboards.all });
        navigate(`/micro-prep/${id}`, { replace: true });
      })
      .catch((err) => {
        setError(err?.message || "Could not create whiteboard");
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
      <Spinner /> Creating board…
    </div>
  );
}
