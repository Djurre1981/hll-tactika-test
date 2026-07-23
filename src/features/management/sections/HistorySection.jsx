import { MatchHistoryPanel } from "../../records/MatchHistoryPanel.jsx";

export function HistorySection() {
  return (
    <div className="glass-scroll flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-1 py-1">
      <header>
        <h1 className="m-0 text-[clamp(1.35rem,2vw,1.75rem)] font-medium tracking-wide text-white">
          Match history
        </h1>
        <p className="m-0 mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-white/50">
          Past matches with recorded results. Open any row for the full Match Brief.
        </p>
      </header>
      <MatchHistoryPanel compact />
    </div>
  );
}
