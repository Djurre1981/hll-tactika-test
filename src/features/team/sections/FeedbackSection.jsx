const PLACEHOLDER_ITEMS = [
  { id: "bugs", title: "Open bug reports", detail: "Inbox for user-submitted issues." },
  { id: "features", title: "Feature requests", detail: "Prioritize community suggestions." },
  { id: "triage", title: "Triage queue", detail: "Assign and close feedback threads." },
];

export function FeedbackSection({ onPlaceholder }) {
  return (
    <div className="glass-scroll flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-1 py-1">
      <header>
        <h1 className="m-0 text-[clamp(1.35rem,2vw,1.75rem)] font-medium tracking-wide text-white">
          Bugs / Features Messages
        </h1>
        <p className="m-0 mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-white/50">
          Placeholder workspace for feedback — no live inbox yet.
        </p>
      </header>

      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          className="glass-control"
          onClick={() => onPlaceholder?.("New feedback form")}
        >
          New feedback form
        </button>
        <button
          type="button"
          className="glass-control"
          onClick={() => onPlaceholder?.("Export feedback CSV")}
        >
          Export feedback CSV
        </button>
        <button
          type="button"
          className="glass-control"
          onClick={() => onPlaceholder?.("Notify Discord channel")}
        >
          Notify Discord channel
        </button>
      </div>

      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
        {PLACEHOLDER_ITEMS.map((item) => (
          <li
            key={item.id}
            className="rounded-[1.375rem] border border-dashed border-white/12 bg-white/[0.03] p-4"
          >
            <h2 className="m-0 text-[0.95rem] font-medium text-white">{item.title}</h2>
            <p className="m-0 mt-2 text-[0.78rem] text-white/45">{item.detail}</p>
            <button
              type="button"
              className="glass-control mt-4"
              onClick={() => onPlaceholder?.(item.title)}
            >
              Open
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
