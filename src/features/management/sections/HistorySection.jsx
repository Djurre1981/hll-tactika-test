import { useState } from "react";
import { MatchHistoryPanel } from "../../records/MatchHistoryPanel.jsx";
import { StratHistoryPanel } from "../../records/StratHistoryPanel.jsx";

const TABS = [
  { id: "matches", label: "Match history" },
  { id: "strats", label: "Strat history" },
];

export function HistorySection() {
  const [tab, setTab] = useState("matches");
  const isStrats = tab === "strats";

  return (
    <div className="glass-scroll flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-1 py-1">
      <header>
        <h1 className="m-0 text-[clamp(1.35rem,2vw,1.75rem)] font-medium tracking-wide text-white">
          History
        </h1>
        <p className="m-0 mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-white/50">
          {isStrats
            ? "Browse strats with search and sort by date, opponent, map, faction, and strongpoint."
            : "Past matches with recorded results. Open any row for the full Match Brief."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`rounded-full border px-3.5 py-1.5 text-[0.78rem] tracking-wide transition ${
                  active
                    ? "border-white/25 bg-white/15 text-white"
                    : "border-white/10 bg-white/[0.04] text-white/60 hover:border-white/20 hover:text-white/85"
                }`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>
      {isStrats ? <StratHistoryPanel compact /> : <MatchHistoryPanel compact />}
    </div>
  );
}
