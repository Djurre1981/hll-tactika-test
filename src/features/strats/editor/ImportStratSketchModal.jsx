import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client.js";
import { queryKeys } from "../../../lib/query-keys.js";
import { cx, fieldLabel, glassInput, glassPillBtn, glassSurface } from "./editorUi.js";

export function ImportStratSketchModal({ open, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const briefingHref = url.trim().startsWith("http")
    ? url.trim()
    : url.trim()
      ? `https://stratsketch.com/${url.trim()}`
      : "https://stratsketch.com/";

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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[4px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import from StratSketch"
        className={cx(glassSurface, "w-full max-w-[28rem] p-5")}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-[0.85rem] top-[0.85rem] border-0 bg-transparent text-[1.4rem] leading-none text-white/[0.72] hover:text-white"
        >
          &times;
        </button>

        <header className="pr-8">
          <h2 className="m-0 mb-[0.35rem] text-[1.05rem] font-light tracking-wide text-white">
            Import from StratSketch
          </h2>
          <p className="m-0 mb-4 text-[0.82rem] leading-relaxed text-white/45">
            Paste a StratSketch briefing URL or code. Slides are imported as PNG snapshots with
            title and creator metadata when available.
          </p>
        </header>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className={fieldLabel}>
            URL or code
            <input
              type="text"
              required
              value={url}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://stratsketch.com/DbvCaCJLCrW"
              className={cx(glassInput, "mt-1")}
            />
          </label>

          <label className={fieldLabel}>
            Title <span className="font-normal text-white/35">(optional)</span>
            <input
              type="text"
              maxLength={80}
              value={title}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Uses StratSketch title if empty"
              className={cx(glassInput, "mt-1")}
            />
          </label>

          <p
            className={cx(
              "m-0 min-h-[1.2rem] text-[0.78rem] leading-[1.4]",
              error ? "text-[#ff6b6b]" : "text-white/45"
            )}
            aria-live="polite"
          >
            {status}
          </p>

          <p className="m-0 text-[0.74rem] leading-relaxed text-white/45">
            StratSketch does not expose per-slide PNG exports publicly, so each slide is rendered to
            PNG during import. If loading fails, open the briefing on{" "}
            <a
              href={briefingHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/70 underline-offset-2 hover:text-white hover:underline"
            >
              stratsketch.com
            </a>{" "}
            first and continue as guest.
          </p>

          <button type="submit" disabled={busy} className={glassPillBtn}>
            {busy ? "Importing…" : "Import"}
          </button>
        </form>
      </div>
    </div>
  );
}
