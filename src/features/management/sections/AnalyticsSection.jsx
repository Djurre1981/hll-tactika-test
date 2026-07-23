import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Spinner } from "../../../shared/Spinner.jsx";
import { useMatchHistoryQuery } from "../../records/hooks/useMatchHistoryQuery.js";
import {
  aggregateWinLossByMonth,
  aggregateWinRateByMap,
  aggregateWinRateByOpponent,
  summarizeTeamKpis,
} from "../../records/team-kpi-utils.js";

const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };

const tooltipStyle = {
  backgroundColor: "rgba(16, 18, 22, 0.94)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  color: "#fff",
  fontSize: "0.78rem",
};

function ChartCard({ title, subtitle, children, emptyMessage }) {
  return (
    <article className="rounded-[1.375rem] border border-white/10 bg-white/[0.04] p-4">
      <header className="mb-4">
        <h2 className="m-0 text-[1rem] font-medium text-white">{title}</h2>
        {subtitle ? <p className="m-0 mt-1 text-[0.78rem] text-white/45">{subtitle}</p> : null}
      </header>
      {children || (
        <p className="m-0 rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-[0.82rem] text-white/40">
          {emptyMessage}
        </p>
      )}
    </article>
  );
}

function SummaryChip({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="m-0 text-[0.65rem] uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="m-0 mt-1 text-[1.15rem] font-medium text-white">{value}</p>
    </div>
  );
}

function winRateColor(rate) {
  if (rate == null) return "#94a3b8";
  if (rate >= 60) return "#34d399";
  if (rate >= 40) return "#fbbf24";
  return "#f87171";
}

export function AnalyticsSection() {
  const historyQuery = useMatchHistoryQuery();
  const events = historyQuery.data || [];
  const kpis = summarizeTeamKpis(events);
  const byMonth = aggregateWinLossByMonth(events);
  const byMap = aggregateWinRateByMap(events);
  const byOpponent = aggregateWinRateByOpponent(events);

  if (historyQuery.isLoading) {
    return (
      <div className="flex items-center gap-3 text-white/55">
        <Spinner />
        <span>Loading analytics…</span>
      </div>
    );
  }

  if (historyQuery.error) {
    return (
      <p className="m-0 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
        {historyQuery.error.message || "Could not load analytics."}
      </p>
    );
  }

  const hasResults = kpis.recorded > 0;

  return (
    <div className="glass-scroll flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-1 py-1">
      <header>
        <h1 className="m-0 text-[clamp(1.35rem,2vw,1.75rem)] font-medium tracking-wide text-white">
          Analytics
        </h1>
        <p className="m-0 mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-white/50">
          Win/loss trends from calendar match results over the last 24 months.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryChip label="Win rate" value={kpis.winRateLabel} />
        <SummaryChip label="Record" value={kpis.recordLabel || "—"} />
        <SummaryChip label="Wins" value={kpis.wins} />
        <SummaryChip label="Losses" value={kpis.losses} />
      </div>

      {!hasResults ? (
        <ChartCard
          title="No match results yet"
          subtitle="Record win/loss on past calendar events to populate charts."
          emptyMessage="Analytics will appear once at least one past event has a recorded result."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Results by month" subtitle="Wins and losses over time">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth} margin={CHART_MARGIN}>
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
                  <Legend wrapperStyle={{ color: "rgba(255,255,255,0.65)", fontSize: "0.75rem" }} />
                  <Bar dataKey="wins" name="Wins" fill="#34d399" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="losses" name="Losses" fill="#f87171" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Win rate by map" subtitle="Minimum one recorded match per map">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMap} layout="vertical" margin={{ ...CHART_MARGIN, left: 8 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                    tickLine={false}
                    unit="%"
                  />
                  <YAxis
                    type="category"
                    dataKey="mapId"
                    width={92}
                    tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, _name, item) => [
                      `${value}% (${item.payload.wins}-${item.payload.losses})`,
                      "Win rate",
                    ]}
                  />
                  <Bar dataKey="winRate" name="Win rate" radius={[0, 4, 4, 0]}>
                    {byMap.map((row) => (
                      <Cell key={row.mapId} fill={winRateColor(row.winRate)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {byOpponent.length ? (
            <ChartCard title="Win rate vs opponent" subtitle="Top opponents by matches played">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byOpponent} margin={CHART_MARGIN}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis
                      dataKey="opponent"
                      tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                      tickLine={false}
                      interval={0}
                      angle={-18}
                      textAnchor="end"
                      height={64}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, _name, item) => [
                        `${value}% (${item.payload.total} matches)`,
                        "Win rate",
                      ]}
                    />
                    <Bar dataKey="winRate" name="Win rate" radius={[4, 4, 0, 0]}>
                      {byOpponent.map((row) => (
                        <Cell key={row.opponent} fill={winRateColor(row.winRate)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          ) : null}
        </div>
      )}
    </div>
  );
}
