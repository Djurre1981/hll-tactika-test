import { useState } from "react";
import {
  useExportD1SqlMutation,
  useExportKvMutation,
  useExportPinsMutation,
  useTestDiscordAlertMutation,
} from "../hooks/useTeamQuery.js";

export function OwnerToolsSection({ onPlaceholder }) {
  const [actionStatus, setActionStatus] = useState({ message: "", isError: false });
  const exportPins = useExportPinsMutation();
  const exportD1 = useExportD1SqlMutation();
  const exportKv = useExportKvMutation();
  const testAlert = useTestDiscordAlertMutation();
  const actionPending =
    exportPins.isPending || exportD1.isPending || exportKv.isPending || testAlert.isPending;

  function handleExportPins() {
    setActionStatus({ message: "Preparing pin backup…", isError: false });
    exportPins.mutate(undefined, {
      onSuccess: (data) =>
        setActionStatus({
          message: `Pin backup downloaded (${data?.pinCount ?? "?"} pins).`,
          isError: false,
        }),
      onError: (error) =>
        setActionStatus({ message: error.message || "Could not export pins", isError: true }),
    });
  }

  function handleExportD1() {
    setActionStatus({ message: "Preparing full D1 SQL backup…", isError: false });
    exportD1.mutate(undefined, {
      onSuccess: () =>
        setActionStatus({
          message: "Full D1 SQL backup downloaded.",
          isError: false,
        }),
      onError: (error) =>
        setActionStatus({ message: error.message || "Could not export D1 backup", isError: true }),
    });
  }

  function handleExportKv() {
    setActionStatus({ message: "Preparing KV JSON backup…", isError: false });
    exportKv.mutate(undefined, {
      onSuccess: (data) =>
        setActionStatus({
          message: `KV backup downloaded (${data?.keyCount ?? "?"} keys, skipped ${data?.skippedCount ?? 0}).`,
          isError: false,
        }),
      onError: (error) =>
        setActionStatus({ message: error.message || "Could not export KV backup", isError: true }),
    });
  }

  function handleTestAlert() {
    setActionStatus({ message: "Sending Discord probe…", isError: false });
    testAlert.mutate(undefined, {
      onSuccess: (result) => {
        const count = result.sent || result.webhookCount || 1;
        setActionStatus({
          message:
            count > 1
              ? `Discord probe sent to ${count} webhooks.`
              : "Discord probe sent. Check your alert channel.",
          isError: false,
        });
      },
      onError: (error) =>
        setActionStatus({ message: error.message || "Alert test failed", isError: true }),
    });
  }

  return (
    <div className="glass-scroll flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-1 py-1">
      <header>
        <h1 className="m-0 text-[clamp(1.35rem,2vw,1.75rem)] font-medium tracking-wide text-white">
          Owner Tools
        </h1>
        <p className="m-0 mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-white/50">
          Backups and owner-only system actions. Placeholders toast until wired.
        </p>
      </header>

      {actionStatus.message ? (
        <p
          className={`m-0 min-h-[1.2rem] text-[0.82rem] text-white/55${actionStatus.isError ? " text-[#f0a8a8]" : ""}`}
        >
          {actionStatus.message}
        </p>
      ) : null}

      <section className="rounded-[1.375rem] border border-white/10 bg-white/[0.04] p-4">
        <h2 className="m-0 text-[1rem] font-medium text-white">Backup Database</h2>
        <p className="m-0 mt-1 text-[0.78rem] text-white/45">Live owner exports</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            className="glass-control"
            onClick={handleExportD1}
            disabled={actionPending}
          >
            Export full D1 SQL
          </button>
          <button
            type="button"
            className="glass-control"
            onClick={handleExportKv}
            disabled={actionPending}
          >
            Export KV JSON
          </button>
          <button
            type="button"
            className="glass-control"
            onClick={handleExportPins}
            disabled={actionPending}
          >
            Export D1 pin backup
          </button>
        </div>
      </section>

      <section className="rounded-[1.375rem] border border-white/10 bg-white/[0.04] p-4">
        <h2 className="m-0 text-[1rem] font-medium text-white">Discord tweaks</h2>
        <p className="m-0 mt-1 text-[0.78rem] text-white/45">Alert probes and future bot controls</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            className="glass-control"
            onClick={handleTestAlert}
            disabled={actionPending}
          >
            Test Discord alert
          </button>
          <button
            type="button"
            className="glass-control"
            onClick={() => onPlaceholder?.("Webhook settings")}
          >
            Webhook settings
          </button>
        </div>
      </section>

      <section className="rounded-[1.375rem] border border-dashed border-white/12 bg-white/[0.03] p-4">
        <h2 className="m-0 text-[1rem] font-medium text-white">More owner tools</h2>
        <p className="m-0 mt-1 text-[0.78rem] text-white/45">Placeholder actions</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            className="glass-control"
            onClick={() => onPlaceholder?.("Backup Videos")}
          >
            Backup Videos
          </button>
          <button
            type="button"
            className="glass-control"
            onClick={() => onPlaceholder?.("Purge stale sessions")}
          >
            Purge stale sessions
          </button>
          <button
            type="button"
            className="glass-control"
            onClick={() => onPlaceholder?.("Rotate service tokens")}
          >
            Rotate service tokens
          </button>
        </div>
      </section>
    </div>
  );
}
