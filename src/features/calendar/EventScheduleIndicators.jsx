import { eventScheduleComponentBadges } from "../events/event-brief-utils.js";

export function EventScheduleIndicators({ components, className = "", compact = false }) {
  const badges = eventScheduleComponentBadges(components);
  if (!badges.length) return null;

  const chipClass = compact
    ? "gap-1 px-1.5 py-0.5 text-[0.62rem]"
    : "gap-1 px-2 py-0.5 text-[0.68rem]";
  const iconClass = compact ? "text-[0.58rem]" : "text-[0.62rem]";
  const wrapGap = compact ? "gap-1" : "gap-1.5";

  return (
    <span
      className={`flex flex-wrap items-center ${wrapGap} ${className}`.trim()}
      aria-label={badges.map((badge) => badge.title).join(", ")}
    >
      {badges.map((badge) => (
        <span
          key={badge.kind}
          title={badge.title}
          className={`inline-flex items-center rounded-full border leading-none ${chipClass} ${badge.chipClass}`}
        >
          <i className={`fa-solid ${badge.icon} ${iconClass}`} aria-hidden="true" />
          {badge.count > 1 ? <span className="tabular-nums">{badge.count}</span> : null}
        </span>
      ))}
    </span>
  );
}
