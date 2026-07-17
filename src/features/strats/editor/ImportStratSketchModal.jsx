import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";

export function ImportStratSketchModal({ open, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(false);
    setStatus("Importing…");
    try {
      const data = await apiClient("/strats/import-stratsketch", {
        method: "POST",
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim() || undefined,
        }),
      });
      const id = data?.strat?.id;
      if (!id) throw new Error("Import failed");
      queryClient.setQueryData(queryKeys.strats.byId(id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.strats.meta });
      queryClient.invalidateQueries({ queryKey: queryKeys.strats.all });
      setStatus("Imported.");
      onClose?.();
      navigate(`/strats/${id}`);
    } catch (err) {
      setError(true);
      setStatus(err?.message || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-label="Import from StratSketch"
        className="relative w-full max-w-md rounded-2xl border border-white/14 bg-[rgba(40,40,42,0.95)] p-5 shadow-2xl"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 text-xl text-white/50 hover:text-white"
        >
          ×
        </button>
        <h2 className="pr-8 text-lg font-medium text-white">Import from StratSketch</h2>
        <p className="mt-1 text-sm text-white/50">
          Paste a StratSketch briefing URL or code.
        </p>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <label className="block text-xs text-white/45">
            URL or code
            <input
              type="text"
              required
              value={url}
              disabled={busy}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://stratsketch.com/…"
              className="mt-1 w-full rounded-lg border border-white/12 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </label>
          <label className="block text-xs text-white/45">
            Title <span className="text-white/30">(optional)</span>
            <input
              type="text"
              maxLength={80}
              value={title}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Uses StratSketch title if empty"
              className="mt-1 w-full rounded-lg border border-white/12 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </label>
          {status && (
            <p className={`text-xs ${error ? "text-red-300" : "text-white/50"}`}>{status}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white hover:bg-white/15 disabled:opacity-40"
          >
            {busy ? "Importing…" : "Import"}
          </button>
        </form>
      </div>
    </div>
  );
}
