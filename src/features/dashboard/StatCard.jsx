import { Spinner } from "../../shared/Spinner.jsx";

export function StatCard({ label, value, detail, loading, error }) {
  return (
    <article className="glass-surface p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-muted">{label}</p>
      <div className="mt-5 flex items-end justify-between gap-4">
        {loading ? <Spinner /> : <span className="text-5xl font-medium text-text">{value}</span>}
        <span className="text-right text-sm text-muted">{error ? "Unavailable" : detail}</span>
      </div>
    </article>
  );
}
