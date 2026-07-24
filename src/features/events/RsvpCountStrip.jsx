/**
 * Compact In / Wait / Out / N/A strip for event rows.
 * @param {{ counts?: { confirmed?: number, waitlist?: number, declined?: number, unavailable?: number, total?: number } | null, compact?: boolean, className?: string }} props
 */
export function RsvpCountStrip({ counts, compact = false, className = "" }) {
  if (!counts || !(counts.total > 0)) return null;

  const cells = [
    ["In", counts.confirmed ?? 0, "text-emerald-200"],
    ["Wait", counts.waitlist ?? 0, "text-sky-200"],
    ["Out", counts.declined ?? 0, "text-red-200"],
    ["N/A", counts.unavailable ?? 0, "text-white/55"],
  ];

  if (compact) {
    return (
      <div
        className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.65rem] tabular-nums ${className}`.trim()}
        title="RSVP counts"
      >
        {cells.map(([label, value, color], index) => (
          <span key={label} className="inline-flex items-center gap-1">
            {index > 0 ? <span className="text-white/20" aria-hidden="true">·</span> : null}
            <span className="uppercase tracking-[0.08em] text-white/35">{label}</span>
            <span className={`font-medium ${color}`}>{value}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-4 gap-1.5 ${className}`.trim()}>
      {cells.map(([label, value, color]) => (
        <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1">
          <p className="m-0 text-[0.55rem] uppercase tracking-[0.1em] text-white/40">{label}</p>
          <p className={`m-0 text-[0.95rem] font-medium tabular-nums ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}
