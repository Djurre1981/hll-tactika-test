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
import { FAKE_DAILY_VISITS, FAKE_FEATURE_USAGE } from "../fakeAdminMetrics.js";

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

function PlaceholderButton({ label, onClick }) {
  return (
    <button type="button" className="glass-control" onClick={onClick}>
      {label}
    </button>
  );
}

export function OverviewSection({ onPlaceholder }) {
  return (
    <div className="glass-scroll flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-1 py-1">
      <header>
        <h1 className="m-0 text-[clamp(1.35rem,2vw,1.75rem)] font-medium tracking-wide text-white">
          Website Overview
        </h1>
        <p className="m-0 mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-white/50">
          General usage metrics (demo data — not live telemetry).
        </p>
      </header>

      <div className="flex flex-wrap gap-2.5">
        <PlaceholderButton label="Export usage report" onClick={() => onPlaceholder?.("Export usage report")} />
        <PlaceholderButton label="Traffic filters" onClick={() => onPlaceholder?.("Traffic filters")} />
        <PlaceholderButton label="Compare weeks" onClick={() => onPlaceholder?.("Compare weeks")} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Daily visits" subtitle="Last 7 days (demo)">
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={FAKE_DAILY_VISITS} margin={CHART_MARGIN}>
                <defs>
                  <linearGradient id="adminVisitsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(96,165,250,0.45)" />
                    <stop offset="100%" stopColor="rgba(96,165,250,0)" />
                  </linearGradient>
                </defs>
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
                  dataKey="visits"
                  name="Visits"
                  stroke="#60a5fa"
                  fill="url(#adminVisitsFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Feature activity" subtitle="Relative engagement (demo)">
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={FAKE_FEATURE_USAGE} margin={CHART_MARGIN}>
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
                <Bar dataKey="count" name="Opens" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
