import { useEffect, useMemo, useState } from "react";
import {
  PREP_TASK_TYPES,
  defaultEnabledPrepTypes,
} from "../../../functions/lib/prep-task-types.js";
import { isPoolStatus } from "../management/rosterRoles.js";
import { useRosterMembersQuery, useRostersQuery } from "../management/hooks/useRostersQuery.js";
import { GlassSelect } from "../../shared/GlassSelect.jsx";
import {
  useCompletePrepSlotMutation,
  useEventPrepPlanQuery,
  useSaveEventPrepPlanMutation,
} from "./hooks/useEventPrepPlanQuery.js";

function memberLabel(member) {
  if (!member) return "Unassigned";
  const named = String(member.displayName || member.name || "").trim();
  if (named) return named;
  const id = String(member.steamId || "");
  return id.length > 8 ? `…${id.slice(-4)}` : id || "Unknown";
}

function emptySlotsForEventType(eventType) {
  const enabled = new Set(defaultEnabledPrepTypes(eventType));
  return PREP_TASK_TYPES.map((meta) => ({
    taskType: meta.id,
    enabled: enabled.has(meta.id),
    primarySteamId: "",
    helperSteamIds: [],
    note: "",
  }));
}

function slotsFromPlan(planSlots) {
  const byType = new Map((planSlots || []).map((slot) => [slot.taskType, slot]));
  return PREP_TASK_TYPES.map((meta) => {
    const row = byType.get(meta.id);
    return {
      taskType: meta.id,
      enabled: Boolean(row?.enabled),
      primarySteamId: row?.primarySteamId || "",
      helperSteamIds: Array.isArray(row?.helperSteamIds) ? row.helperSteamIds : [],
      note: row?.note || "",
      status: row?.status || "not_started",
      label: row?.label || meta.label,
      autoInProgress: Boolean(row?.autoInProgress),
      completedAt: row?.completedAt || null,
    };
  });
}

function statusLabel(status) {
  if (status === "done") return "Done";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

function statusClass(status) {
  if (status === "done") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  if (status === "in_progress") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-white/10 bg-white/[0.04] text-white/50";
}

function pickCompRosterId(rosters = []) {
  return (
    rosters.find((row) => row.id === "roster-default")?.id ||
    rosters.find((row) => !row.isTemplate)?.id ||
    rosters[0]?.id ||
    null
  );
}

function PrepToggleGrid({ slots, canEdit, pending, onToggle }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {PREP_TASK_TYPES.map((meta) => {
        const slot = slots.find((row) => row.taskType === meta.id);
        const enabled = Boolean(slot?.enabled);
        return (
          <label
            key={meta.id}
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[0.85rem] transition ${
              enabled
                ? "border-white/[0.12] bg-black/20 text-white"
                : "border-white/[0.06] bg-black/10 text-white/55"
            } ${!canEdit || pending ? "cursor-not-allowed opacity-60" : "hover:border-white/16"}`}
          >
            <input
              type="checkbox"
              checked={enabled}
              disabled={!canEdit || pending}
              onChange={(event) => onToggle(meta.id, event.target.checked)}
            />
            <span>{meta.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function PrepSlotRow({
  slot,
  meta,
  canEdit,
  canComplete,
  memberOptions,
  membersById,
  pending,
  onChange,
  onToggleDone,
}) {
  const helpers = slot.helperSteamIds || [];
  const helperOne = helpers[0] || "";
  const helperTwo = helpers[1] || "";

  return (
    <li
      className={`rounded-2xl border px-3 py-3 ${
        slot.enabled ? "border-white/[0.08] bg-black/20" : "border-white/[0.05] bg-black/10 opacity-70"
      }`}
    >
      <div className="flex flex-wrap items-start gap-3">
        {canEdit ? (
          <label className="mt-1 flex shrink-0 items-center gap-2">
            <input
              type="checkbox"
              checked={slot.enabled}
              disabled={pending}
              onChange={(event) => onChange({ enabled: event.target.checked })}
            />
            <span className="sr-only">Require {meta.label}</span>
          </label>
        ) : null}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="m-0 text-[0.92rem] font-medium text-white">{meta.label}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[0.64rem] uppercase tracking-[0.08em] ${statusClass(slot.status)}`}>
              {statusLabel(slot.status)}
              {slot.autoInProgress ? " · linked" : ""}
            </span>
          </div>

          {slot.enabled ? (
            <div className="grid gap-2 lg:grid-cols-3">
              <label className="block min-w-0 text-[0.78rem]">
                <span className="mb-1 block text-white/40">Primary</span>
                <GlassSelect
                  value={slot.primarySteamId || ""}
                  disabled={!canEdit || pending}
                  onChange={(value) => onChange({ primarySteamId: value })}
                  placeholder="Select player…"
                  options={memberOptions}
                />
              </label>
              <label className="block min-w-0 text-[0.78rem]">
                <span className="mb-1 block text-white/40">Helper</span>
                <GlassSelect
                  value={helperOne}
                  disabled={!canEdit || pending}
                  onChange={(value) =>
                    onChange({
                      helperSteamIds: [value, helperTwo].filter(Boolean),
                    })
                  }
                  placeholder="Optional"
                  options={[{ value: "", label: "None" }, ...memberOptions]}
                />
              </label>
              <label className="block min-w-0 text-[0.78rem]">
                <span className="mb-1 block text-white/40">Helper 2</span>
                <GlassSelect
                  value={helperTwo}
                  disabled={!canEdit || pending}
                  onChange={(value) =>
                    onChange({
                      helperSteamIds: [helperOne, value].filter(Boolean),
                    })
                  }
                  placeholder="Optional"
                  options={[{ value: "", label: "None" }, ...memberOptions]}
                />
              </label>
            </div>
          ) : null}

          {slot.enabled && meta.id === "other" ? (
            <label className="block text-[0.78rem]">
              <span className="mb-1 block text-white/40">Notes</span>
              <input
                type="text"
                value={slot.note || ""}
                disabled={!canEdit || pending}
                onChange={(event) => onChange({ note: event.target.value })}
                placeholder="What needs doing?"
                className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[0.85rem] text-white outline-none transition focus:border-accent/40"
              />
            </label>
          ) : null}

          {slot.enabled ? (
            <p className="m-0 text-[0.72rem] text-white/40">
              {slot.primarySteamId
                ? `Primary: ${memberLabel(membersById.get(slot.primarySteamId))}`
                : "No primary assignee yet"}
            </p>
          ) : null}
        </div>

        {slot.enabled && canComplete ? (
          <label className="mt-1 flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-[0.78rem] text-white/75">
            <input
              type="checkbox"
              checked={slot.status === "done"}
              disabled={pending}
              onChange={(event) => onToggleDone(event.target.checked)}
            />
            Done
          </label>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Shared event preparation checklist for Event form + Match Brief.
 */
export function EventPrepChecklist({
  eventId = null,
  eventType = "scrim",
  canEdit = false,
  eventLocked = false,
  compact = false,
  embedded = false,
  onSlotsChange,
  userSteamId = null,
  isEditor = false,
}) {
  const editable = canEdit && !eventLocked;
  const showAssignees = Boolean(eventId);
  const planQuery = useEventPrepPlanQuery(eventId, Boolean(eventId));
  const savePlan = useSaveEventPrepPlanMutation(eventId || "draft");
  const completeSlot = useCompletePrepSlotMutation(eventId);
  const rostersQuery = useRostersQuery();
  const rosterId = useMemo(
    () => pickCompRosterId(rostersQuery.data?.rosters || []),
    [rostersQuery.data]
  );
  const membersQuery = useRosterMembersQuery(rosterId);

  const [localSlots, setLocalSlots] = useState(() => emptySlotsForEventType(eventType));
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!eventId) {
      setLocalSlots(emptySlotsForEventType(eventType));
      setDirty(false);
      return;
    }
    if (planQuery.data?.slots) {
      setLocalSlots(slotsFromPlan(planQuery.data.slots));
      setDirty(false);
    }
  }, [eventId, eventType, planQuery.data?.slots]);

  useEffect(() => {
    if (onSlotsChange) onSlotsChange(localSlots);
  }, [localSlots, onSlotsChange]);

  const membersById = useMemo(() => {
    const map = new Map();
    for (const member of membersQuery.data?.members || []) {
      if (member?.steamId) map.set(member.steamId, member);
    }
    return map;
  }, [membersQuery.data]);

  const memberOptions = useMemo(
    () =>
      (membersQuery.data?.members || [])
        .filter((member) => isPoolStatus(member.status))
        .map((member) => ({ value: member.steamId, label: memberLabel(member) }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
    [membersQuery.data]
  );

  const pending = savePlan.isPending || completeSlot.isPending;
  const openCount = localSlots.filter((slot) => slot.enabled && slot.status !== "done").length;

  function patchSlot(taskType, patch) {
    setLocalSlots((current) =>
      current.map((slot) => (slot.taskType === taskType ? { ...slot, ...patch } : slot))
    );
    setDirty(true);
  }

  async function handleSave() {
    if (!eventId || !editable) return;
    setSaveError("");
    try {
      const payload = localSlots.map((slot) => ({
        taskType: slot.taskType,
        enabled: slot.enabled,
        primarySteamId: slot.primarySteamId || null,
        helperSteamIds: slot.helperSteamIds || [],
        note: slot.note || "",
      }));
      const plan = await savePlan.mutateAsync(payload);
      setLocalSlots(slotsFromPlan(plan.slots));
      setDirty(false);
    } catch (error) {
      setSaveError(error?.message || "Could not save prep plan.");
    }
  }

  async function handleToggleDone(taskType, done) {
    if (!eventId) return;
    try {
      const plan = await completeSlot.mutateAsync({ taskType, done });
      setLocalSlots(slotsFromPlan(plan.slots));
    } catch {
      // query refetch on settle
    }
  }

  function canCompleteSlot(slot) {
    if (!slot.enabled || eventLocked) return false;
    if (isEditor) return true;
    const id = String(userSteamId || "");
    if (!id) return false;
    if (String(slot.primarySteamId) === id) return true;
    return (slot.helperSteamIds || []).includes(id);
  }

  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.03] ${compact ? "p-3" : "p-4"}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-white/45">
            Event preparation
          </h2>
          {!compact ? (
            <p className="m-0 mt-1 text-[0.78rem] text-white/40">
              {showAssignees
                ? "Assign comp roster players to each task. Strat tasks auto-start when a linked strat with the matching prep category is attached."
                : "Choose which prep tasks apply. Assign players on Match Brief after saving."}
            </p>
          ) : null}
        </div>
        {openCount ? (
          <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[0.68rem] text-white/45">
            {openCount} open
          </span>
        ) : null}
      </div>

      {eventId && planQuery.isLoading ? (
        <p className="m-0 text-[0.85rem] text-white/45">Loading prep plan…</p>
      ) : !showAssignees ? (
        <PrepToggleGrid
          slots={localSlots}
          canEdit={editable}
          pending={pending}
          onToggle={(taskType, enabled) => patchSlot(taskType, { enabled })}
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {PREP_TASK_TYPES.map((meta) => {
            const slot = localSlots.find((row) => row.taskType === meta.id) || {
              taskType: meta.id,
              enabled: false,
              primarySteamId: "",
              helperSteamIds: [],
              note: "",
              status: "not_started",
            };
            return (
              <PrepSlotRow
                key={meta.id}
                slot={slot}
                meta={meta}
                canEdit={editable}
                canComplete={canCompleteSlot(slot)}
                memberOptions={memberOptions}
                membersById={membersById}
                pending={pending}
                onChange={(patch) => patchSlot(meta.id, patch)}
                onToggleDone={(done) => handleToggleDone(meta.id, done)}
              />
            );
          })}
        </ul>
      )}

      {editable && eventId && !embedded ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pending || !dirty}
            onClick={handleSave}
            className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-[0.82rem] text-emerald-100 transition hover:border-emerald-300/45 disabled:opacity-50"
          >
            {savePlan.isPending ? "Saving…" : "Save prep plan"}
          </button>
          {saveError ? <p className="m-0 text-[0.78rem] text-red-200/90">{saveError}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

export function prepSlotsPayload(slots = []) {
  return (slots || []).map((slot) => ({
    taskType: slot.taskType,
    enabled: Boolean(slot.enabled),
    primarySteamId: slot.primarySteamId || null,
    helperSteamIds: slot.helperSteamIds || [],
    note: slot.note || "",
  }));
}

export { emptySlotsForEventType, slotsFromPlan };
