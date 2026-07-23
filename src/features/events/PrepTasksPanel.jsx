import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthGate.jsx";
import { canEditEvents } from "../calendar/calendar-utils.js";
import { GlassSelect } from "../../shared/GlassSelect.jsx";
import { usePresenceMembersQuery } from "../home/hooks/usePresenceMembersQuery.js";
import {
  useCreatePrepTaskMutation,
  useDeletePrepTaskMutation,
  usePrepTasksQuery,
  useUpdatePrepTaskMutation,
} from "./hooks/usePrepTasksQuery.js";

function memberLabel(member) {
  if (!member) return "Unknown";
  return member.name || member.steamId;
}

function PrepTaskRow({ task, canEdit, canComplete, memberName, pending, onToggle, onDelete }) {
  return (
    <li
      className={`rounded-2xl border px-4 py-3 ${
        task.completed
          ? "border-white/[0.06] bg-black/10 opacity-75"
          : "border-white/[0.08] bg-black/20"
      }`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <label className="mt-0.5 flex shrink-0 items-start gap-2">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-white/20 bg-black/30 accent-emerald-400"
            checked={Boolean(task.completed)}
            disabled={!canComplete || pending}
            onChange={(event) => onToggle?.(task, event.target.checked)}
          />
          <span className="sr-only">Mark complete</span>
        </label>

        <div className="min-w-0 flex-1">
          <p
            className={`m-0 text-[0.95rem] font-medium ${
              task.completed ? "text-white/55 line-through" : "text-white"
            }`}
          >
            {task.title}
          </p>
          {task.description ? (
            <p className="m-0 mt-1 text-[0.82rem] leading-relaxed text-white/45">{task.description}</p>
          ) : null}
          <p className="m-0 mt-1.5 text-[0.72rem] text-white/40">
            Assigned to {memberName}
            {task.completed && task.completedAt ? " · Done" : ""}
          </p>
        </div>

        {canEdit ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onDelete?.(task.id)}
            className="shrink-0 rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1.5 text-[0.75rem] text-red-100 transition hover:border-red-300/40 hover:bg-red-500/15 disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function PrepTasksPanel({ eventId, canEdit = false }) {
  const user = useAuth();
  const isEditor = canEdit || canEditEvents(user?.role);
  const tasksQuery = usePrepTasksQuery(eventId);
  const membersQuery = usePresenceMembersQuery(isEditor);
  const createMutation = useCreatePrepTaskMutation(eventId);
  const updateMutation = useUpdatePrepTaskMutation(eventId);
  const deleteMutation = useDeletePrepTaskMutation(eventId);

  const [title, setTitle] = useState("");
  const [assigneeSteamId, setAssigneeSteamId] = useState("");
  const [formError, setFormError] = useState("");

  const membersById = useMemo(() => {
    const map = new Map();
    for (const member of membersQuery.data?.users || []) {
      map.set(member.steamId, member);
    }
    return map;
  }, [membersQuery.data]);

  const memberOptions = useMemo(
    () =>
      (membersQuery.data?.users || [])
        .map((member) => ({
          value: member.steamId,
          label: memberLabel(member),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
    [membersQuery.data]
  );

  const pending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  async function handleCreate(event) {
    event.preventDefault();
    if (!isEditor || !title.trim() || !assigneeSteamId) {
      setFormError("Title and assignee are required.");
      return;
    }

    setFormError("");
    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        assigneeSteamId,
      });
      setTitle("");
      setAssigneeSteamId("");
    } catch (error) {
      setFormError(error?.message || "Could not create task.");
    }
  }

  async function handleToggle(task, completed) {
    if (!user?.steamId) return;
    const canComplete =
      isEditor || String(task.assigneeSteamId) === String(user.steamId);
    if (!canComplete) return;

    try {
      await updateMutation.mutateAsync({ taskId: task.id, completed });
    } catch {
      // query will refetch on settle
    }
  }

  async function handleDelete(taskId) {
    try {
      await deleteMutation.mutateAsync(taskId);
    } catch {
      // query will refetch on settle
    }
  }

  const tasks = tasksQuery.data || [];
  const incompleteCount = tasks.filter((task) => !task.completed).length;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-white/45">
          Prep tasks
        </h2>
        {tasks.length ? (
          <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[0.68rem] text-white/45">
            {incompleteCount} open
          </span>
        ) : null}
      </div>

      {isEditor ? (
        <form onSubmit={handleCreate} className="mb-4 grid gap-3 rounded-2xl border border-white/10 bg-black/15 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)_auto]">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-[0.68rem] uppercase tracking-[0.12em] text-white/40">
              Task
            </span>
            <input
              type="text"
              value={title}
              disabled={pending}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Review strat slides"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[0.88rem] text-white outline-none transition focus:border-accent/40"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-[0.68rem] uppercase tracking-[0.12em] text-white/40">
              Assign to
            </span>
            <GlassSelect
              value={assigneeSteamId}
              disabled={pending || membersQuery.isLoading}
              onChange={setAssigneeSteamId}
              placeholder={membersQuery.isLoading ? "Loading…" : "Select player…"}
              options={memberOptions}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={pending || !title.trim() || !assigneeSteamId}
              className="w-full rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-[0.82rem] text-emerald-100 transition hover:border-emerald-300/45 hover:bg-emerald-400/15 disabled:opacity-50 sm:w-auto"
            >
              Add task
            </button>
          </div>
          {formError ? (
            <p className="m-0 text-[0.78rem] text-red-200/90 sm:col-span-3">{formError}</p>
          ) : null}
        </form>
      ) : null}

      {tasksQuery.isLoading ? (
        <p className="m-0 text-[0.85rem] text-white/45">Loading prep tasks…</p>
      ) : tasksQuery.error ? (
        <p className="m-0 text-[0.85rem] text-red-200/90">{tasksQuery.error.message}</p>
      ) : !tasks.length ? (
        <p className="m-0 text-[0.85rem] text-white/45">
          {isEditor
            ? "No prep tasks yet — assign checklist items above."
            : "No prep tasks assigned to you for this match."}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {tasks.map((task) => {
            const canComplete =
              isEditor || String(task.assigneeSteamId) === String(user?.steamId);
            return (
              <PrepTaskRow
                key={task.id}
                task={task}
                canEdit={isEditor}
                canComplete={canComplete}
                memberName={memberLabel(membersById.get(task.assigneeSteamId))}
                pending={pending}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
