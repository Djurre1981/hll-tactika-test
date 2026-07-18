function PlaceholderCard({ title, subtitle, className = "" }) {
  return (
    <div className={`glass-panel flex min-h-[10rem] flex-col p-5 ${className}`}>
      <h3 className="m-0 text-[1.05rem] font-medium tracking-wide text-white">{title}</h3>
      {subtitle ? <p className="mt-1.5 text-[0.82rem] text-white/45">{subtitle}</p> : null}
      <div className="mt-4 flex-1 rounded-2xl border border-dashed border-white/12 bg-white/[0.03]" />
    </div>
  );
}

export function OverviewSection() {
  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <header>
        <h2 className="m-0 text-[1.65rem] font-medium tracking-wide text-white">Overview</h2>
        <p className="mt-1.5 text-[0.9rem] text-white/50">
          Management hub — upcoming events, tasks, and org tools.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <PlaceholderCard
          title="Upcoming events"
          subtitle="Tournament matches and clan events will show here."
          className="min-h-[16rem]"
        />

        <div className="flex flex-col gap-4">
          <PlaceholderCard title="To-do list" subtitle="Staff tasks and reminders." />
          <PlaceholderCard title="Orga tools" subtitle="Quick links and clan utilities." />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-surface min-h-[5.5rem] rounded-[1.5rem] border border-dashed border-white/12 bg-white/[0.03]" />
        <div className="glass-surface min-h-[5.5rem] rounded-[1.5rem] border border-dashed border-white/12 bg-white/[0.03]" />
        <div className="glass-surface min-h-[5.5rem] rounded-[1.5rem] border border-dashed border-white/12 bg-white/[0.03]" />
      </div>
    </section>
  );
}
