import { Link } from "react-router-dom";
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client.js";
import { queryKeys } from "../../lib/query-keys.js";
import {
  COMPONENT_KINDS,
  SCHEDULE_COMPONENT_KINDS,
  componentStatusLabel,
  groupSlotsByKind,
  hasLinkedComponents,
} from "./event-brief-utils.js";
import { EventComponentAttachSection } from "./EventComponentAttachControls.jsx";
import { useEventComponentActions } from "./hooks/useEventComponentActions.js";
import { useResolvedEventComponents } from "./hooks/useResolvedEventComponents.js";

function ComponentRow({ item, canEdit, pending, onDetach }) {
  const isOpenable = item.status === "ok" && item.href;
  const statusNote = item.status !== "ok" ? componentStatusLabel(item.status) : "";
  const canDetach = canEdit && item.id;

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
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isOpenable ? (
            <Link
              to={item.href}
              className="rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[0.78rem] text-white/90 no-underline transition hover:border-accent/40 hover:bg-white/10"
            >
              Open
            </Link>
          ) : item.status === "restricted" && COMPONENT_KINDS[item.kind]?.href ? (
            <span className="rounded-full border border-white/10 px-3 py-1.5 text-[0.72rem] text-white/35">
              Admin only
            </span>
          ) : null}
          {canDetach ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onDetach?.(item.kind, item.id)}
              className="rounded-full border border-red-400/25 bg-red-500/10 px-3.5 py-1.5 text-[0.78rem] text-red-100 transition hover:border-red-300/40 hover:bg-red-500/15 disabled:opacity-50"
            >
              Detach
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function scheduleKindDef(kind) {
  return SCHEDULE_COMPONENT_KINDS.find((def) => def.kind === kind);
}

function ComponentGroup({ kind, items, canEdit, pending, onDetach }) {
  if (!items.length) return null;
  const def = COMPONENT_KINDS[kind];
  const scheduleDef = scheduleKindDef(kind);
  return (
    <section>
      <h3 className="m-0 mb-2 flex items-center gap-2 text-[0.72rem] font-normal uppercase tracking-[0.16em] text-white/45">
        {scheduleDef ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.62rem] normal-case tracking-normal ${scheduleDef.chipClass}`}
          >
            <i className={`fa-solid ${scheduleDef.icon}`} aria-hidden="true" />
            {items.length}
          </span>
        ) : null}
        <span>{items.length === 1 ? def.label : def.plural}</span>
      </h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((item) => (
          <ComponentRow
            key={`${item.kind}-${item.id}`}
            item={item}
            canEdit={canEdit}
            pending={pending}
            onDetach={onDetach}
          />
        ))}
      </ul>
    </section>
  );
}

export function EventComponentsPanel({
  eventId,
  components,
  canEdit = false,
  canAttachRoster = false,
  canAttachLineup = false,
  eventLocked = false,
}) {
  const queryClient = useQueryClient();
  const { resolved, isLoading } = useResolvedEventComponents(components);
  const grouped = groupSlotsByKind(resolved);
  const linked = hasLinkedComponents(components);
  const actions = useEventComponentActions(canEdit && !eventLocked ? eventId : null);
  const [lineupPending, setLineupPending] = useState(false);
  const [lineupError, setLineupError] = useState("");

  const showAttach = canEdit && eventId && !eventLocked;

  const createLineup = useCallback(async () => {
    if (!eventId) return;
    setLineupError("");
    setLineupPending(true);
    try {
      await apiClient("/lineups", {
        method: "POST",
        body: JSON.stringify({ eventId }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.events.byId(eventId) });
    } catch (error) {
      setLineupError(error?.message || "Could not create LineUp.");
    } finally {
      setLineupPending(false);
    }
  }, [eventId, queryClient]);

  return (
    <div className="flex flex-col gap-5">
      {showAttach ? (
        <EventComponentAttachSection
          components={components}
          canEdit={canEdit}
          canAttachRoster={canAttachRoster}
          canAttachLineup={canAttachLineup}
          pending={actions.pending}
          onAttach={actions.attach}
          onCreateLineup={createLineup}
          lineupPending={lineupPending}
        />
      ) : null}

      {actions.error || lineupError ? (
        <p className="m-0 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-[0.85rem] text-red-100">
          {actions.error || lineupError}
        </p>
      ) : null}

      {!linked && !showAttach ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-5 py-8 text-center">
          <p className="m-0 text-[0.95rem] text-white/70">Nothing linked yet</p>
          <p className="m-0 mt-2 text-[0.82rem] leading-relaxed text-white/40">
            Link strats, route plans, or whiteboards from their editors.
          </p>
        </div>
      ) : null}

      {!linked && showAttach ? (
        <p className="m-0 text-[0.85rem] text-white/45">
          No tools linked yet — use the attach controls above.
        </p>
      ) : null}

      {linked && isLoading && resolved.every((item) => item.status === "loading") ? (
        <p className="text-[0.9rem] text-white/45">Loading linked tools…</p>
      ) : null}

      {linked ? (
        <div className="flex flex-col gap-5">
          <ComponentGroup
            kind="lineup"
            items={grouped.lineup}
            canEdit={canEdit && !eventLocked}
            pending={actions.pending}
            onDetach={actions.detach}
          />
          <ComponentGroup
            kind="strat"
            items={grouped.strat}
            canEdit={canEdit && !eventLocked}
            pending={actions.pending}
            onDetach={actions.detach}
          />
          <ComponentGroup
            kind="routePlan"
            items={grouped.routePlan}
            canEdit={canEdit && !eventLocked}
            pending={actions.pending}
            onDetach={actions.detach}
          />
          <ComponentGroup
            kind="whiteboard"
            items={grouped.whiteboard}
            canEdit={canEdit && !eventLocked}
            pending={actions.pending}
            onDetach={actions.detach}
          />
          <ComponentGroup
            kind="roster"
            items={grouped.roster}
            canEdit={canEdit && !eventLocked}
            pending={actions.pending}
            onDetach={actions.detach}
          />
        </div>
      ) : null}
    </div>
  );
}
