import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FAKE_OWNER_ALERTS, FAKE_SIGNIN_SOURCES } from "../fakeAdminMetrics.js";

const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };

const tooltipStyle = {
  backgroundColor: "rgba(16, 18, 22, 0.94)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  color: "#fff",
  fontSize: "0.78rem",
};

function ChartCard({ title, subtitle, children }) {
  return (
    <article className="rounded-[1.375rem] border border-white/10 bg-white/[0.04] p-4">
      <header className="mb-4">
        <h2 className="m-0 text-[1rem] font-medium text-white">{title}</h2>
        {subtitle ? <p className="m-0 mt-1 text-[0.78rem] text-white/45">{subtitle}</p> : null}
      </header>
      {children}
    </article>
  );
}

export function OwnerMetricsSection({ onPlaceholder }) {
  return (
    <div className="glass-scroll flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-1 py-1">
      <header>
        <h1 className="m-0 text-[clamp(1.35rem,2vw,1.75rem)] font-medium tracking-wide text-white">
          Owner Metrics
        </h1>
        <p className="m-0 mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-white/50">
          Usage logs and anomaly signals (demo data — owners only).
        </p>
      </header>

      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          className="glass-control"
          onClick={() => onPlaceholder?.("Weird usage alerts")}
        >
          Weird usage alerts
        </button>
        <button
          type="button"
          className="glass-control"
          onClick={() => onPlaceholder?.("Raw access logs")}
        >
          Raw access logs
        </button>
        <button
          type="button"
          className="glass-control"
          onClick={() => onPlaceholder?.("Session inspector")}
        >
          Session inspector
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Request baseline vs spikes" subtitle="Last 24h (demo)">
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={FAKE_OWNER_ALERTS} margin={CHART_MARGIN}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="baseline"
                  name="Baseline"
                  stroke="#94a3b8"
                  fill="rgba(148,163,184,0.2)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="spikes"
                  name="Spikes"
                  stroke="#f87171"
                  fill="rgba(248,113,113,0.25)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Sign-in device mix" subtitle="Share of sessions (demo)">
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={FAKE_SIGNIN_SOURCES} margin={CHART_MARGIN}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                  tickLine={false}
                />
                <YAxis
                  unit="%"
                  tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Share" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
