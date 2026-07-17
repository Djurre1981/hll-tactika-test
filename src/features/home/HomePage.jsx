import { useAuth } from "../auth/AuthGate.jsx";
import { useDashboardQuery } from "../dashboard/hooks/useDashboardQuery.js";
import { useHub } from "./HubContext.jsx";

function formatEventMeta(event) {
  return event.eventType || "Schedule";
}

function formatEventTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function placeholderCards() {
  return [
    {
      key: "scrim",
      meta: "Scrim",
      title: "TBD",
      sub: "Placeholder slot",
      muted: true,
    },
    {
      key: "comp",
      meta: "Comp",
      title: "TBD",
      sub: "Placeholder slot",
      muted: true,
    },
  ];
}

export function HomePage() {
  const user = useAuth();
  const { upcoming } = useDashboardQuery();
  const { showToast } = useHub();
  const name = user.name || "Operator";
  const events = upcoming.data?.events || [];
  const canStrats = user.role && user.role !== "viewer";

  function handleToolClick(tool) {
    if (tool.placeholder) {
      showToast("HLL Records — coming soon");
      return;
    }

    if (tool.id === "strats") {
      window.location.assign("/tool/stratmaker");
      return;
    }

    if (tool.id === "micro-prep") {
      window.location.assign("/tool/micro-prep");
      return;
    }

    if (tool.id === "viewer") {
      window.location.assign("/climbing-guide-v1/");
    }
  }

  const upcomingCards =
    events.length > 0
      ? events.map((event) => ({
          key: event.id,
          meta: formatEventMeta(event),
          title: event.title,
          sub: formatEventTime(event.startsAt),
          muted: false,
        }))
      : [
          {
            key: "empty",
            meta: "Schedule",
            title: "No matches listed",
            sub: "Add events from Calendar.",
            muted: false,
          },
          ...placeholderCards(),
        ];

  return (
    <>
      <header className="dashboard-page__header">
        <h1 className="dashboard-page__greeting">Welcome back, {name}</h1>
        <p className="dashboard-page__tagline">
          Your Circle command hub — prep, climb intel, and strats in one place.
        </p>
      </header>

      <div className="dashboard-page__grid">
        <section className="dashboard-hero glass-surface" aria-labelledby="dashboard-hero-title">
          <p className="dashboard-hero__eyebrow">Overview</p>
          <h2 className="dashboard-hero__title" id="dashboard-hero-title">
            Circle operations
          </h2>
          <p className="dashboard-hero__body">
            Jump into the climbing guide for pin intel, or open Stratmaker to plan the next match.
            More Circle tools will land here as they come online.
          </p>
        </section>

        <aside className="dashboard-upcoming glass-surface" aria-labelledby="dashboard-upcoming-title">
          <h2 className="dashboard-upcoming__title" id="dashboard-upcoming-title">
            Upcoming games
          </h2>
          <div className="dashboard-upcoming__list">
            {upcomingCards.map((card) => (
              <article
                key={card.key}
                className={`dashboard-upcoming__card${card.muted ? " dashboard-upcoming__card--muted" : ""}`}
              >
                <p className="dashboard-upcoming__card-meta">{card.meta}</p>
                <p className="dashboard-upcoming__card-title">{card.title}</p>
                <p className="dashboard-upcoming__card-sub">{card.sub}</p>
              </article>
            ))}
          </div>
        </aside>

        <section className="dashboard-tools" aria-labelledby="dashboard-tools-title">
          <h2 className="dashboard-tools__title" id="dashboard-tools-title">
            The Circle Tools
          </h2>
          <div className="dashboard-tools__grid">
            <button
              type="button"
              className={`dashboard-tool glass-surface${canStrats ? "" : " is-role-locked"}`}
              disabled={!canStrats}
              aria-disabled={!canStrats}
              onClick={() => handleToolClick({ id: "strats" })}
            >
              <span className="dashboard-tool__title">Circle Stratmaker</span>
              <span className="dashboard-tool__desc">Draw and share ops on the tactical map.</span>
            </button>
            <button
              type="button"
              className={`dashboard-tool glass-surface${canStrats ? "" : " is-role-locked"}`}
              disabled={!canStrats}
              aria-disabled={!canStrats}
              onClick={() => handleToolClick({ id: "micro-prep" })}
            >
              <span className="dashboard-tool__title">Micro Prep</span>
              <span className="dashboard-tool__desc">
                Brainstorm and sketch on a shared whiteboard.
              </span>
            </button>
            <button
              type="button"
              className="dashboard-tool glass-surface dashboard-tool--climb"
              onClick={() => handleToolClick({ id: "viewer" })}
            >
              <span className="dashboard-tool__title">Climbing Guide</span>
              <span className="dashboard-tool__desc">Interactive climb and MG spot map.</span>
            </button>
            <button
              type="button"
              className="dashboard-tool glass-surface"
              onClick={() => handleToolClick({ id: "records", placeholder: true })}
            >
              <span className="dashboard-tool__title">HLL Records</span>
              <span className="dashboard-tool__desc">VODs and result history — coming soon.</span>
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
