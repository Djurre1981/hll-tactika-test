import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client.js";
import { queryKeys } from "../../lib/query-keys.js";
import { Spinner } from "../../shared/Spinner.jsx";
import { glassSurface } from "../../shared/glassUi.js";

const MODES = [
  {
    id: "whiteboard",
    title: "Whiteboard",
    desc: "Unlimited canvas for freeform brainstorming and sketches.",
  },
  {
    id: "slideshow",
    title: "Slideshow",
    desc: "Slide-by-slide prep on a fixed 16:9 stage.",
  },
];

/**
 * Micro-Prep entry: choose Whiteboard or Slideshow, then create a D1 board.
 */
export function MicroPrepEntryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(null);

  const createBoard = async (mode) => {
    if (creating) return;
    setError(null);
    setCreating(mode);

    try {
      const data = await apiClient("/whiteboards", {
        method: "POST",
        body: JSON.stringify({
          whiteboard: {
            mode,
            title: mode === "slideshow" ? "Untitled Slideshow" : "Untitled Board",
          },
        }),
      });
      const id = data?.whiteboard?.id;
      if (!id) throw new Error("Create failed");
      queryClient.setQueryData(queryKeys.whiteboards.byId(id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.whiteboards.all });
      navigate(`/micro-prep/${id}`, { replace: true });
    } catch (err) {
      setError(err?.message || "Could not create board");
      setCreating(null);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-[#0f0f0f] p-6">
      <div className="text-center">
        <h1 className="m-0 text-2xl font-light tracking-[0.04em] text-white/90">
          Micro Prep
        </h1>
        <p className="mt-2 text-sm font-light text-white/45">
          Choose how you want to prep.
        </p>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {MODES.map((mode) => {
          const busy = creating === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              disabled={Boolean(creating)}
              onClick={() => createBoard(mode.id)}
              className={`${glassSurface} flex min-h-[180px] flex-col items-start justify-center gap-3 p-8 text-left transition hover:border-white/25 hover:bg-[rgba(60,60,60,0.9)] disabled:cursor-wait disabled:opacity-60`}
            >
              <span className="text-xl font-light tracking-[0.06em] text-white/95">
                {mode.title}
              </span>
              <span className="text-sm font-light leading-relaxed text-white/50">
                {mode.desc}
              </span>
              {busy ? (
                <span className="mt-2 inline-flex items-center gap-2 text-xs text-white/40">
                  <Spinner /> Creating…
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {error ? <p className="text-sm text-red-400/90">{error}</p> : null}

      <Link to="/home" className="text-sm text-amber-300/90 hover:underline">
        Back to hub
      </Link>
    </div>
  );
}
