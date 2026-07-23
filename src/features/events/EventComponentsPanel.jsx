import { Link } from "react-router-dom";
import {
  COMPONENT_KINDS,
  componentStatusLabel,
  groupSlotsByKind,
  hasLinkedComponents,
} from "./event-brief-utils.js";
import { useResolvedEventComponents } from "./hooks/useResolvedEventComponents.js";

function ComponentRow({ item }) {
  const isOpenable = item.status === "ok" && item.href;
  const statusNote = item.status !== "ok" ? componentStatusLabel(item.status) : "";

  return (
    <li className="rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-white/40">
            {item.label}
          </p>
          <p
            className={`m-0 mt-1 truncate text-[0.95rem] font-medium ${
              item.status === "missing" ? "text-red-200/90" : "text-white"
            }`}
          >
            {item.title}
          </p>
          {statusNote ? (
            <p className="m-0 mt-1 text-[0.78rem] text-white/45">{statusNote}</p>
          ) : null}
        </div>
        {isOpenable ? (
          <Link
            to={item.href}
            className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[0.78rem] text-white/90 no-underline transition hover:border-accent/40 hover:bg-white/10"
          >
            Open
          </Link>
        ) : item.status === "restricted" && COMPONENT_KINDS[item.kind]?.href ? (
          <span className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-[0.72rem] text-white/35">
            Admin only
          </span>
        ) : null}
      </div>
    </li>
  );
}

function ComponentGroup({ kind, items }) {
  if (!items.length) return null;
  const def = COMPONENT_KINDS[kind];
  return (
    <section>
      <h3 className="m-0 mb-2 text-[0.72rem] font-normal uppercase tracking-[0.16em] text-white/45">
        {items.length === 1 ? def.label : def.plural}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((item) => (
          <ComponentRow key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </ul>
    </section>
  );
}

export function EventComponentsPanel({ components }) {
  const { resolved, isLoading } = useResolvedEventComponents(components);
  const grouped = groupSlotsByKind(resolved);

  if (!hasLinkedComponents(components)) {
    return (
      <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-5 py-8 text-center">
        <p className="m-0 text-[0.95rem] text-white/70">Nothing linked yet</p>
        <p className="m-0 mt-2 text-[0.82rem] leading-relaxed text-white/40">
          Strats, route plans, whiteboards, and roster links will appear here once attached.
          Attach tools arrive in the next step (T5).
        </p>
      </div>
    );
  }

  if (isLoading && resolved.every((item) => item.status === "loading")) {
    return <p className="text-[0.9rem] text-white/45">Loading linked tools…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <ComponentGroup kind="strat" items={grouped.strat} />
      <ComponentGroup kind="routePlan" items={grouped.routePlan} />
      <ComponentGroup kind="whiteboard" items={grouped.whiteboard} />
      <ComponentGroup kind="roster" items={grouped.roster} />
    </div>
  );
}
