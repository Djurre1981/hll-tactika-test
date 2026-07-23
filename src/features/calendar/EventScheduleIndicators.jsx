import { eventScheduleComponentBadges } from "../events/event-brief-utils.js";

export function EventScheduleIndicators({ components }) {
  const badges = eventScheduleComponentBadges(components);
  if (!badges.length) return null;

  return (
    <span
      className="mt-1 flex flex-wrap items-center gap-1"
      aria-label={badges.map((badge) => badge.title).join(", ")}
    >
      {badges.map((badge) => (
        <span
          key={badge.kind}
          title={badge.title}
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[0.62rem] leading-none ${badge.chipClass}`}
        >
          <i className={`fa-solid ${badge.icon} text-[0.58rem]`} aria-hidden="true" />
          {badge.count > 1 ? <span className="tabular-nums">{badge.count}</span> : null}
        </span>
      ))}
    </span>
  );
}
