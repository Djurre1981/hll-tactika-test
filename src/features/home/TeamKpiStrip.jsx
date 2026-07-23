import { Link } from "react-router-dom";
import { Spinner } from "../../shared/Spinner.jsx";
import { useMatchHistoryQuery } from "../records/hooks/useMatchHistoryQuery.js";
import { summarizeTeamKpis } from "../records/team-kpi-utils.js";

function KpiCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="m-0 text-[0.65rem] uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="m-0 mt-1 text-[1.35rem] font-medium text-white">{value}</p>
      {hint ? <p className="m-0 mt-1 text-[0.72rem] text-white/45">{hint}</p> : null}
    </div>
  );
}

function FormBadge({ result }) {
  const isWin = result === "win";
  return (
    <span
      className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border px-2 text-[0.72rem] font-medium ${
        isWin
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : "border-red-400/30 bg-red-500/10 text-red-200"
      }`}
    >
      {isWin ? "W" : "L"}
    </span>
  );
}

export function TeamKpiStrip() {
  const historyQuery = useMatchHistoryQuery();
  const kpis = summarizeTeamKpis(historyQuery.data || []);

  if (historyQuery.isLoading) {
    return (
      <div className="flex items-center gap-3 text-white/55">
        <Spinner />
        <span className="text-[0.85rem]">Loading team stats…</span>
      </div>
    );
  }

  if (historyQuery.error) {
    return (
      <p className="m-0 text-[0.85rem] text-white/50">
        Team stats unavailable right now.
      </p>
    );
  }

  const hasResults = kpis.recorded > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Win rate"
          value={kpis.winRateLabel}
          hint={hasResults ? `${kpis.recorded} recorded matches` : "No results logged yet"}
        />
        <KpiCard
          label="Record"
          value={kpis.recordLabel || "—"}
          hint={hasResults ? `${kpis.wins} wins · ${kpis.losses} losses` : "Log results on calendar events"}
        />
        <KpiCard
          label="Recent form"
          value={kpis.formLabel || "—"}
          hint={hasResults ? "Latest 5 results" : "Win/loss from Match Brief"}
        />
        <KpiCard
          label="Past matches"
          value={kpis.entries}
          hint="Scrims, comps, and recorded results"
        />
      </div>

      {kpis.form.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {kpis.form.map((result, index) => (
            <FormBadge key={`${result}-${index}`} result={result} />
          ))}
        </div>
      ) : null}

      <p className="m-0 text-[0.78rem] text-white/45">
        Based on the last 24 months of calendar results.{" "}
        <Link to="/management#analytics" className="text-sky-200/90 no-underline hover:text-sky-100">
          Open analytics
        </Link>
        {" · "}
        <Link to="/records" className="text-sky-200/90 no-underline hover:text-sky-100">
          Match history
        </Link>
      </p>
    </div>
  );
}
