import { useMemo } from "react";
import { GlassSelect } from "../../shared/GlassSelect.jsx";
import { COMPONENT_KINDS, SCHEDULE_COMPONENT_KINDS } from "./event-brief-utils.js";
import { linkedIdsForKind } from "./event-component-sync.js";
import {
  useAttachableRoutePlansQuery,
  useAttachableRostersQuery,
  useAttachableStratsQuery,
  useAttachableWhiteboardsQuery,
} from "./hooks/useAttachableAssets.js";

function scheduleKindDef(kind) {
  return SCHEDULE_COMPONENT_KINDS.find((def) => def.kind === kind);
}

function useOptionsForKind(kind, components, canAttachRoster) {
  const stratsQuery = useAttachableStratsQuery(kind === "strat");
  const routePlansQuery = useAttachableRoutePlansQuery(kind === "routePlan");
  const whiteboardsQuery = useAttachableWhiteboardsQuery(kind === "whiteboard");
  const rostersQuery = useAttachableRostersQuery(kind === "roster" && canAttachRoster);

  const linked = linkedIdsForKind(components, kind);

  return useMemo(() => {
    let items = [];
    let loading = false;
    let loadError = null;

    if (kind === "strat") {
      items = stratsQuery.data || [];
      loading = stratsQuery.isLoading;
      loadError = stratsQuery.error;
    } else if (kind === "routePlan") {
      items = routePlansQuery.data || [];
      loading = routePlansQuery.isLoading;
      loadError = routePlansQuery.error;
    } else if (kind === "whiteboard") {
      items = whiteboardsQuery.data || [];
      loading = whiteboardsQuery.isLoading;
      loadError = whiteboardsQuery.error;
    } else if (kind === "roster") {
      items = rostersQuery.data || [];
      loading = rostersQuery.isLoading;
      loadError = rostersQuery.error;
    }

    const options = (Array.isArray(items) ? items : [])
      .filter((item) => kind === "roster" || !linked.includes(item.id))
      .map((item) => ({
        value: item.id,
        label: item.title || item.name || item.id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

    return { options, loading, loadError };
  }, [
    kind,
    components,
    linked,
    stratsQuery.data,
    stratsQuery.isLoading,
    stratsQuery.error,
    routePlansQuery.data,
    routePlansQuery.isLoading,
    routePlansQuery.error,
    whiteboardsQuery.data,
    whiteboardsQuery.isLoading,
    whiteboardsQuery.error,
    rostersQuery.data,
    rostersQuery.isLoading,
    rostersQuery.error,
  ]);
}

export function EventComponentAttachPicker({
  kind,
  components,
  canAttachRoster,
  disabled,
  onAttach,
}) {
  const def = COMPONENT_KINDS[kind];
  const scheduleDef = scheduleKindDef(kind);
  const { options, loading, loadError } = useOptionsForKind(kind, components, canAttachRoster);

  if (kind === "roster" && !canAttachRoster) {
    return null;
  }

  async function handleChange(value) {
    if (!value) return;
    await onAttach?.(kind, value);
  }

  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.12em] text-white/45">
        {scheduleDef ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[0.58rem] normal-case tracking-normal ${scheduleDef.chipClass}`}
          >
            <i className={`fa-solid ${scheduleDef.icon}`} aria-hidden="true" />
          </span>
        ) : null}
        Attach {kind === "roster" ? def.label.toLowerCase() : def.plural.toLowerCase()}
      </span>
      <GlassSelect
        value=""
        disabled={disabled || loading || !options.length}
        onChange={handleChange}
        placeholder={
          loading
            ? "Loading…"
            : options.length
              ? `Select ${def.label.toLowerCase()}…`
              : kind === "roster"
                ? "All rosters linked"
                : `No ${def.plural.toLowerCase()} available`
        }
        options={options}
      />
      {loadError ? (
        <p className="m-0 mt-1 text-[0.72rem] text-red-200/90">{loadError.message}</p>
      ) : null}
    </label>
  );
}

export function EventComponentAttachSection({
  components,
  canEdit,
  canAttachRoster,
  canAttachLineup = false,
  pending,
  onAttach,
  onCreateLineup,
  lineupPending = false,
}) {
  if (!canEdit) return null;

  const hasLineup = Boolean(components?.lineupId);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="m-0 mb-3 text-[0.72rem] uppercase tracking-[0.16em] text-white/45">
        Attach tools
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <EventComponentAttachPicker
          kind="strat"
          components={components}
          disabled={pending}
          onAttach={onAttach}
        />
        <EventComponentAttachPicker
          kind="routePlan"
          components={components}
          disabled={pending}
          onAttach={onAttach}
        />
        <EventComponentAttachPicker
          kind="whiteboard"
          components={components}
          disabled={pending}
          onAttach={onAttach}
        />
        <EventComponentAttachPicker
          kind="roster"
          components={components}
          canAttachRoster={canAttachRoster}
          disabled={pending}
          onAttach={onAttach}
        />
      </div>
      {canAttachLineup && !hasLineup ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <button
            type="button"
            disabled={pending || lineupPending}
            onClick={() => onCreateLineup?.()}
            className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-[0.82rem] text-emerald-100 transition hover:border-emerald-300/45 hover:bg-emerald-500/15 disabled:opacity-50"
          >
            Create LineUp
          </button>
          <p className="m-0 mt-1.5 text-[0.72rem] text-white/40">
            Uses the event LineUp size (49 / 36 / 18). Set size on the calendar event first.
          </p>
        </div>
      ) : null}
    </section>
  );
}
