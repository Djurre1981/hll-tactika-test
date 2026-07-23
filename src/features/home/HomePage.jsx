import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthGate.jsx";
import { useDashboardQuery } from "./hooks/useDashboardQuery.js";
import { MyPrepTasksWidget } from "./MyPrepTasksWidget.jsx";
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

const toolBtnClass =
  "glass-surface flex min-h-[7.5rem] flex-col items-start justify-end gap-1 rounded-[1.375rem] border border-white/10 bg-white/[0.06] p-5 text-left transition hover:border-white/20 hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-45";

const toolBtnSplitClass =
  "glass-surface flex h-full min-h-0 flex-col items-start justify-end gap-1 rounded-[1.375rem] border border-white/10 bg-white/[0.06] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-45";

export function HomePage() {
  const user = useAuth();
  const navigate = useNavigate();
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
      navigate("/tool/stratmaker");
      return;
    }
    if (tool.id === "micro-prep") {
      navigate("/tool/micro-prep");
      return;
    }
    if (tool.id === "routeplanner") {
      navigate("/tool/routeplanner");
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
          eventId: event.id,
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
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[clamp(1.55rem,2.2vw,2rem)] font-medium tracking-wide text-white">
          Welcome back, {name}
        </h1>
        <p className="m-0 max-w-xl text-[0.88rem] font-light leading-snug tracking-wide text-white/50">
          Your Circle command hub — prep, climb intel, and strats in one place.
        </p>
      </header>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.78fr)] md:grid-rows-[minmax(200px,1fr)_auto]">
        <section
          className="glass-surface flex min-h-[220px] flex-col justify-end gap-2 rounded-[1.375rem] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-6 md:col-start-1 md:row-start-1"
          aria-labelledby="dashboard-hero-title"
        >
          <p className="m-0 text-[0.68rem] font-light uppercase tracking-[0.18em] text-white/40">
            Overview
          </p>
          <h2 className="m-0 text-xl font-medium tracking-wide text-white" id="dashboard-hero-title">
            Circle operations
          </h2>
          <p className="m-0 max-w-xl text-[0.88rem] font-light leading-relaxed text-white/60">
            Jump into the climbing guide for pin intel, or open Stratmaker to plan the next match.
            More Circle tools will land here as they come online.
          </p>
        </section>

        <aside
          className="glass-surface flex min-h-0 flex-col rounded-[1.375rem] border border-white/10 bg-white/[0.055] p-4 md:col-start-2 md:row-span-2 md:row-start-1"
          aria-labelledby="dashboard-upcoming-title"
        >
          <h2
            className="m-0 mb-3 px-1 text-[0.72rem] font-normal uppercase tracking-[0.16em] text-white/50"
            id="dashboard-upcoming-title"
          >
            Upcoming games
          </h2>
          <MyPrepTasksWidget />
          <div className="flex min-h-0 flex-col gap-2 overflow-auto pr-1">
            {upcomingCards.map((card) => {
              const inner = (
                <>
                  <p className="m-0 mb-1 text-[0.65rem] uppercase tracking-[0.14em] text-white/40">
                    {card.meta}
                  </p>
                  <p className="m-0 text-[0.95rem] font-medium text-white">{card.title}</p>
                  <p className="m-0 mt-0.5 text-[0.78rem] text-white/45">{card.sub}</p>
                </>
              );

              if (card.eventId) {
                return (
                  <Link
                    key={card.key}
                    to={`/events/${card.eventId}`}
                    className={`block rounded-[1.125rem] border border-white/10 bg-white/[0.05] px-4 py-3.5 no-underline transition hover:border-accent/35 hover:bg-white/[0.08] ${
                      card.muted ? "opacity-55" : ""
                    }`}
                  >
                    {inner}
                  </Link>
                );
              }

              return (
                <article
                  key={card.key}
                  className={`rounded-[1.125rem] border border-white/10 bg-white/[0.05] px-4 py-3.5 ${
                    card.muted ? "opacity-55" : ""
                  }`}
                >
                  {inner}
                </article>
              );
            })}
          </div>
        </aside>

        <section className="md:col-start-1 md:row-start-2" aria-labelledby="dashboard-tools-title">
          <h2
            className="m-0 mb-3 text-[0.72rem] font-normal uppercase tracking-[0.16em] text-white/50"
            id="dashboard-tools-title"
          >
            The Circle Tools
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid min-h-[7.5rem] grid-cols-2 gap-3">
              <button
                type="button"
                className={toolBtnSplitClass}
                disabled={!canStrats}
                aria-disabled={!canStrats}
                onClick={() => handleToolClick({ id: "strats" })}
              >
                <span className="text-[0.88rem] font-medium leading-tight text-white">Stratmaker</span>
                <span className="text-[0.72rem] font-light leading-snug text-white/50">
                  Draw and share ops on the tactical map.
                </span>
              </button>
              <button
                type="button"
                className={toolBtnSplitClass}
                disabled={!canStrats}
                aria-disabled={!canStrats}
                onClick={() => handleToolClick({ id: "routeplanner" })}
              >
                <span className="text-[0.88rem] font-medium leading-tight text-white">Routeplanner</span>
                <span className="text-[0.72rem] font-light leading-snug text-white/50">
                  Timed transport truck routes on the tacmap.
                </span>
              </button>
            </div>
            <button
              type="button"
              className={toolBtnClass}
              disabled={!canStrats}
              aria-disabled={!canStrats}
              onClick={() => handleToolClick({ id: "micro-prep" })}
            >
              <span className="text-[0.95rem] font-medium text-white">Micro Prep</span>
              <span className="text-[0.78rem] font-light text-white/50">
                Brainstorm and sketch on a shared whiteboard.
              </span>
            </button>
            <button
              type="button"
              className={toolBtnClass}
              onClick={() => handleToolClick({ id: "viewer" })}
            >
              <span className="text-[0.95rem] font-medium text-white">Climbing Guide</span>
              <span className="text-[0.78rem] font-light text-white/50">
                Interactive climb and MG spot map.
              </span>
            </button>
            <button
              type="button"
              className={toolBtnClass}
              onClick={() => handleToolClick({ id: "records", placeholder: true })}
            >
              <span className="text-[0.95rem] font-medium text-white">HLL Records</span>
              <span className="text-[0.78rem] font-light text-white/50">
                VODs and result history — coming soon.
              </span>
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
